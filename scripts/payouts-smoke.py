"""Verify grouped plans and receipts with independent dates and real payment edits."""
from datetime import datetime, timezone
from pathlib import Path
import json
import os

from playwright.sync_api import sync_playwright, expect

URL = os.environ.get('CRM_TEST_URL', 'http://127.0.0.1:4173')
KEY = 'dolya-crm-v1'
Path('test-results').mkdir(exist_ok=True)

def stage(key, name, amount, date, closed=True):
    return {'id': key, 'name': name, 'amount': amount, 'rate': 7,
            'dueDate': date, 'status': 'closed' if closed else 'active',
            'closedDate': date if closed else ''}

def project(key, name, stages):
    return {'id': key, 'name': name, 'client': '', 'code': name[:2], 'color': '#dce9df',
            'sheetUrl': '', 'note': '', 'archived': False, 'stages': stages}

data = {
    'version': 1, 'demo': False,
    'settings': {'name': 'Личное пространство', 'rate': 7, 'startMonth': '2026-10',
                 'salaryPlans': [{'from': '2026-10', 'first': 20000, 'second': 20000},
                                 {'from': '2027-01', 'first': 25000, 'second': 25000}]},
    'projects': [
        project('atlas', 'Атлас', [stage('partial', 'Дизайн', 10000, '2026-11-04'),
                                 stage('planned', 'Аналитика', 20000, '2026-11-10', False),
                                 stage('late', 'Запоздалая выплата', 30000, '2026-10-10'),
                                 stage('future', 'Будущий этап', 40000, '2026-12-10', False)]),
        project('mayak', 'Маяк', [stage('paid', 'Разработка', 5000, '2026-11-01')]),
    ],
    'payments': [
        {'id': 'salary-nov', 'entryId': 'salary-2026-11-01', 'amount': 20000, 'date': '2026-11-02', 'note': ''},
        {'id': 'salary-oct', 'entryId': 'salary-2026-10-15', 'amount': 20000, 'date': '2026-11-04', 'note': ''},
        {'id': 'partial-nov', 'entryId': 'partial', 'amount': 200, 'date': '2026-11-10', 'note': ''},
        {'id': 'late-nov', 'entryId': 'late', 'amount': 800, 'date': '2026-11-12', 'note': 'За октябрь'},
        {'id': 'full', 'entryId': 'paid', 'amount': 350, 'date': '2026-11-02', 'note': ''},
    ],
}

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CRM_BROWSER_PATH', '/usr/bin/chromium'), args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1100}, locale='ru-RU', timezone_id='Asia/Tomsk')
    context.add_init_script(f'if (!localStorage.getItem("{KEY}")) localStorage.setItem("{KEY}", {json.dumps(json.dumps(data))});')
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.clock.install(time=datetime(2026, 11, 16, 6, tzinfo=timezone.utc))
    page.goto(URL.rstrip('/') + '#payments')
    page.emulate_media(reduced_motion='reduce')
    expect(page.get_by_role('heading', name='Мои выплаты', exact=True)).to_be_visible()
    groups = page.locator('.payout-group')
    expect(groups).to_have_count(3)
    expect(groups.first.get_by_role('heading', name='Оклад', exact=True)).to_be_visible()
    expect(page.get_by_role('region', name='Атлас', exact=True)).to_contain_text('2 100 ₽')
    expect(page.get_by_role('region', name='Атлас', exact=True)).to_contain_text('1 900 ₽')
    expect(page.get_by_role('region', name='Итоги по фильтрам')).to_contain_text('42 450 ₽')
    expect(page.get_by_role('region', name='Итоги по фильтрам')).to_contain_text('20 550 ₽')

    # Date filters run before grouping and summary totals.
    page.get_by_label('Плановая дата с', exact=True).fill('2026-11-15')
    page.get_by_label('Плановая дата по', exact=True).fill('2026-11-15')
    expect(groups).to_have_count(2)
    expect(page.get_by_role('region', name='Итоги по фильтрам')).to_contain_text('22 100 ₽')
    page.locator('.payout-reset').click()
    page.get_by_label('Фильтр выплат', exact=True).select_option('paid')
    expect(groups).to_have_count(2)
    expect(page.get_by_role('region', name='Маяк', exact=True)).to_be_visible()
    expect(page.get_by_role('region', name='Атлас', exact=True)).to_have_count(0)
    page.get_by_label('Фильтр выплат', exact=True).select_option('partial')
    expect(groups).to_have_count(1)
    expect(groups.first).to_contain_text('Дизайн')
    expect(groups.first).not_to_contain_text('Аналитика')

    # Receive another partial amount; both group totals and storage must update.
    groups.first.get_by_role('button', name='Отметить получение', exact=True).click()
    page.get_by_label('Полученная сумма, ₽').fill('100')
    page.get_by_role('button', name='Подтвердить получение', exact=True).click()
    expect(groups.first.locator('.payout-group-totals')).to_contain_text('300 ₽')
    expect(groups.first.locator('.payout-group-totals')).to_contain_text('400 ₽')
    page.reload()
    expect(page.get_by_role('region', name='Атлас', exact=True).locator('.payout-group-totals')).to_contain_text('300 ₽')

    page.get_by_role('button', name='История поступлений', exact=True).click()
    expect(page.get_by_role('region', name='Оклад', exact=True).locator('.payout-group-totals')).to_contain_text('40 000 ₽')
    expect(page.get_by_role('region', name='Атлас', exact=True).locator('.payout-group-totals')).to_contain_text('1 100 ₽')
    expect(page.get_by_role('region', name='Атлас', exact=True)).to_contain_text('15 октября 2026')
    page.get_by_label('Дата получения с', exact=True).fill('2026-11-12')
    page.get_by_label('Дата получения по', exact=True).fill('2026-11-16')
    expect(groups).to_have_count(1)
    expect(groups.first.locator('.payout-group-totals')).to_contain_text('900 ₽')
    groups.first.get_by_role('button', name='Удалить выплату 100 ₽', exact=True).click()
    expect(groups.first.locator('.payout-group-totals')).to_contain_text('800 ₽')
    page.get_by_role('button', name='Вернуть', exact=True).click()
    expect(groups.first.locator('.payout-group-totals')).to_contain_text('900 ₽')

    # Source filter also applies to history and leaves the salary separate.
    page.locator('.payout-reset').click()
    page.get_by_label('Источник выплат', exact=True).select_option('salary')
    expect(groups).to_have_count(1)
    expect(groups.first.get_by_role('heading', name='Оклад', exact=True)).to_be_visible()
    page.get_by_label('Источник выплат', exact=True).select_option('atlas')
    expect(groups).to_have_count(1)
    expect(groups.first.get_by_role('heading', name='Атлас', exact=True)).to_be_visible()
    page.locator('.payout-reset').click()

    # A new month clears the effective day range and shows future plans.
    page.get_by_role('button', name='План выплат', exact=True).click()
    page.get_by_label('Плановая дата с', exact=True).fill('2026-11-15')
    page.get_by_label('Выбрать месяц', exact=True).fill('2026-12')
    expect(page.get_by_label('Плановая дата с', exact=True)).to_have_value('')
    expect(page.get_by_role('heading', name='План на декабрь 2026', exact=True)).to_be_visible()
    expect(page.get_by_role('region', name='Атлас', exact=True)).to_contain_text('Будущий этап')
    expect(page.get_by_role('region', name='Итоги по фильтрам')).to_contain_text('42 800 ₽')
    page.get_by_role('button', name='Следующий месяц', exact=True).click()
    expect(page.get_by_role('heading', name='План на январь 2027', exact=True)).to_be_visible()
    expect(page.get_by_role('region', name='Оклад', exact=True).locator('.payout-group-totals')).to_contain_text('50 000 ₽')
    page.get_by_role('button', name='Текущий месяц', exact=True).click()
    expect(page.get_by_label('Выбрать месяц')).to_have_value('2026-11')
    page.locator('.payout-reset').click()

    # Invalid dates report the issue, with no invented totals.
    page.get_by_label('Плановая дата с', exact=True).fill('2026-11-15')
    page.get_by_label('Плановая дата по', exact=True).fill('2026-11-01')
    expect(page.get_by_role('alert')).to_contain_text('Дата начала')
    expect(groups).to_have_count(0)
    page.locator('.payout-reset').click()

    # The all-time overdue view keeps older debt visible and disables day filters.
    page.get_by_label('Выбрать месяц').fill('2027-01')
    page.get_by_label('Фильтр выплат').select_option('overdue')
    expect(page.get_by_label('Плановая дата с')).to_be_disabled()
    expect(page.get_by_role('region', name='Атлас', exact=True)).to_contain_text('15 октября 2026')
    page.get_by_role('button', name='Текущий месяц', exact=True).click()

    for tab in ('План выплат', 'История поступлений'):
        page.get_by_role('button', name=tab, exact=True).click()
        for width in (390, 768, 1440):
            page.set_viewport_size({'width': width, 'height': 1050})
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (tab, width)
            page.screenshot(path=f'test-results/payouts-{"history" if tab.startswith("История") else "plan"}-{width}.png', full_page=True)
    assert not errors, errors
    print('PASS: separate salary, project groups, filtered totals, paid/partial statuses, actual vs planned dates, late receipts, payment registration, persistence, delete/undo, source filters, future months/year, overdue debt and 390/768/1440 layouts; no JS errors.')
    browser.close()
