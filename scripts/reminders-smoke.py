"""Check payday reminders with the browser clock and migrate legacy data safely."""
from copy import deepcopy
from datetime import datetime, timezone
import json
import os

from playwright.sync_api import sync_playwright, expect

url = os.environ.get('CRM_TEST_URL', 'http://127.0.0.1:4173')
key = 'dolya-crm-v1'
backup_key = 'dolya-crm-before-demo-removal-v1'
data = {
    'version': 1, 'demo': False,
    'settings': {'name': 'Мои проекты', 'rate': 7, 'startMonth': '2026-11',
                 'salaryPlans': [{'from': '2026-11', 'first': 20000, 'second': 20000}]},
    'projects': [],
    'payments': [{'id': 'first', 'entryId': 'salary-2026-11-01', 'amount': 20000,
                  'date': '2026-11-01', 'note': ''}],
}

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CRM_BROWSER_PATH', '/usr/bin/chromium'), args=['--no-sandbox'])
    errors = []

    def open_workspace(day, workspace):
        context = browser.new_context(viewport={'width': 1440, 'height': 1000}, locale='ru-RU', timezone_id='Asia/Tomsk')
        context.add_init_script(f'if (!localStorage.getItem("{key}")) localStorage.setItem("{key}", {json.dumps(json.dumps(workspace))});')
        page = context.new_page()
        page.emulate_media(reduced_motion='reduce')
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.clock.install(time=datetime(2026, 11, day, 3, tzinfo=timezone.utc))
        page.goto(url)
        expect(page.get_by_role('heading', name='Обзор доходов')).to_be_visible()
        return context, page

    context, page = open_workspace(12, data)
    reminder = page.get_by_role('region', name='Напоминание о выплате')
    expect(reminder).to_have_count(0)
    page.clock.fast_forward(24 * 60 * 60 * 1000)
    expect(reminder).to_contain_text('Через 2 дня — выплата 20 000 ₽')
    page.screenshot(path='test-results/reminder-desktop.png', full_page=True)
    for width in (390, 768, 1440):
        page.set_viewport_size({'width': width, 'height': 900})
        page.clock.run_for(350)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
        page.screenshot(path=f'test-results/reminder-{width}.png', full_page=True)
    page.clock.fast_forward(24 * 60 * 60 * 1000)
    expect(reminder).to_contain_text('Завтра — выплата')
    page.clock.fast_forward(24 * 60 * 60 * 1000)
    expect(reminder).to_contain_text('Сегодня — выплата')
    page.clock.fast_forward(24 * 60 * 60 * 1000)
    expect(reminder).to_have_count(0)
    context.close()

    context, page = open_workspace(13, data)
    reminder = page.get_by_role('region', name='Напоминание о выплате')
    reminder.get_by_role('button', name='Посмотреть выплаты').click()
    expect(page.get_by_role('heading', name='Мои выплаты', exact=True)).to_be_visible()
    page.get_by_role('button', name='Отметить получение', exact=True).click()
    page.get_by_label('Полученная сумма, ₽').fill('5000')
    page.get_by_role('button', name='Подтвердить получение').click()
    expect(reminder).to_contain_text('выплата 15 000 ₽')
    page.reload()
    expect(reminder).to_contain_text('выплата 15 000 ₽')
    page.get_by_role('button', name='Отметить получение', exact=True).click()
    page.get_by_role('button', name='Подтвердить получение').click()
    expect(reminder).to_have_count(0)
    context.close()

    mixed = deepcopy(data)
    mixed['demo'] = True
    mixed['projects'] = [
        {'id': 'example', 'name': 'Сайт для «Архитек»', 'client': 'Архитек · архитектурное бюро',
         'code': 'Ар', 'color': '#dce9df', 'sheetUrl': '', 'note': '', 'archived': False, 'stages': []},
        {'id': 'personal', 'name': 'Мой настоящий проект', 'client': 'Мой клиент',
         'code': 'М', 'color': '#dce9df', 'sheetUrl': '', 'note': '', 'archived': False, 'stages': []},
    ]
    context, page = open_workspace(13, mixed)
    stored = page.evaluate(f'JSON.parse(localStorage.getItem("{key}"))')
    assert stored['demo'] is False
    assert [project['id'] for project in stored['projects']] == ['personal']
    assert stored['payments'] == mixed['payments']
    assert page.evaluate(f'JSON.parse(localStorage.getItem("{backup_key}"))') == mixed
    page.get_by_role('link', name='Настройки', exact=True).click()
    with page.expect_download() as download:
        page.get_by_role('button', name='Копия до обновления', exact=True).click()
    from pathlib import Path
    assert json.loads(Path(download.value.path()).read_text()) == mixed
    context.close()

    assert not errors, errors
    browser.close()
    print('PASS: reminders appear 2 days before payday, update across midnight, disappear after full payment; partial amounts and reload; responsive reminder; legacy cleanup preserves personal records and original backup.')
