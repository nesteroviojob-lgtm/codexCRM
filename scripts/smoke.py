from playwright.sync_api import sync_playwright, expect
import json
import os
from pathlib import Path

Path('test-results').mkdir(exist_ok=True)
url = os.environ.get('CRM_TEST_URL', 'http://127.0.0.1:4173')

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CRM_BROWSER_PATH', '/usr/bin/chromium'), args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1440,'height':1000}, locale='ru-RU')
    errors=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(url)
    expect(page.get_by_role('heading', name='Обзор доходов')).to_be_visible()
    page.screenshot(path='test-results/overview-desktop.png', full_page=True)
    assert page.evaluate('JSON.parse(localStorage.getItem("dolya-crm-v1")).projects.length') == 0
    expect(page.locator('.demo-banner')).to_have_count(0)
    page.get_by_role('button',name='Новый проект',exact=True).click()
    page.get_by_label('Название проекта').fill('CRM для студии')
    page.get_by_label('Клиент',exact=True).fill('Студия Север')
    page.get_by_label('Бюджет в Google').fill('https://docs.google.com/spreadsheets/d/example')
    page.get_by_role('button',name='Создать проект').click()
    expect(page.get_by_role('heading',name='CRM для студии',exact=True)).to_be_visible()
    page.get_by_role('button',name='Добавить этап',exact=True).click()
    page.get_by_label('Название этапа').fill('Дизайн интерфейса')
    page.get_by_label('Бюджет этапа, ₽').fill('180000')
    page.get_by_role('button',name='Сохранить этап').click()
    expect(page.get_by_role('cell',name='12 600 ₽ 7% от бюджета')).to_be_visible()
    page.get_by_role('button',name='Закрыть этап',exact=True).click()
    page.get_by_role('button',name='Сохранить этап').click()
    page.get_by_role('button',name='Получить',exact=True).click()
    page.get_by_label('Полученная сумма, ₽').fill('5000')
    page.get_by_role('button',name='Подтвердить получение').click()
    expect(page.get_by_text('Получено 5 000 ₽',exact=True)).to_be_visible()
    page.reload()
    expect(page.get_by_text('Получено 5 000 ₽',exact=True)).to_be_visible()
    page.get_by_role('button',name='Получить',exact=True).click()
    expect(page.get_by_label('Полученная сумма, ₽')).to_have_value('7600')
    # Escape dismisses modal and focus returns to its trigger.
    page.keyboard.press('Escape')
    expect(page.get_by_role('dialog')).to_have_count(0)
    page.get_by_role('link',name='Выплаты',exact=False).first.click()
    page.get_by_role('button',name='История поступлений',exact=True).click()
    expect(page.get_by_role('cell',name='+5 000 ₽',exact=True)).to_be_visible()
    page.get_by_role('button',name='Удалить выплату').click()
    expect(page.get_by_role('dialog')).to_have_count(0)
    expect(page.get_by_role('heading',name='Поступлений пока нет')).to_be_visible()
    page.get_by_role('button',name='Вернуть',exact=True).click()
    expect(page.get_by_role('cell',name='+5 000 ₽',exact=True)).to_be_visible()
    page.get_by_role('button',name='Удалить выплату').click()
    expect(page.get_by_role('heading',name='Поступлений пока нет')).to_be_visible()
    page.get_by_role('link',name='Проекты',exact=True).click()
    page.get_by_role('button',name='CRM для студии',exact=False).first.click()
    page.get_by_role('button',name='Получить',exact=True).click()
    expect(page.get_by_label('Полученная сумма, ₽')).to_have_value('12600')
    page.get_by_role('button',name='Подтвердить получение').click()
    expect(page.get_by_text('Получено',exact=True)).to_be_visible()
    page.get_by_role('link',name='Настройки',exact=True).click()
    with page.expect_download() as download:
        page.get_by_role('button',name='Скачать копию',exact=True).click()
    path=download.value.path()
    backup=json.loads(Path(path).read_text())
    assert backup['projects'][0]['name']=='CRM для студии'
    assert backup['payments'][0]['amount']==12600
    # Invalid import is rejected without losing the workspace.
    page.locator('input[type=file]').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':b'{"version":1}'})
    expect(page.locator('.toast')).to_contain_text('не похож')
    # Export can be restored through explicit confirmation.
    page.locator('input[type=file]').set_input_files({'name':'backup.json','mimeType':'application/json','buffer':json.dumps(backup).encode()})
    page.get_by_role('button',name='Подтвердить',exact=True).click()
    page.reload()
    expect(page.get_by_label('Название пространства')).to_have_value('Личное пространство')
    # Project deletion is one click, cascades its receipts, and can be undone.
    page.get_by_role('link',name='Проекты',exact=True).click()
    page.get_by_role('button',name='Удалить проект CRM для студии',exact=True).click()
    expect(page.get_by_role('dialog')).to_have_count(0)
    expect(page.get_by_role('heading',name='Добавим первый проект?')).to_be_visible()
    stored=page.evaluate('JSON.parse(localStorage.getItem("dolya-crm-v1"))')
    assert stored['projects']==[] and stored['payments']==[]
    page.get_by_role('button',name='Вернуть',exact=True).click()
    page.get_by_role('button',name='CRM для студии',exact=False).first.click()
    expect(page.get_by_text('Получено',exact=True)).to_be_visible()
    page.get_by_role('button',name='Удалить проект CRM для студии',exact=True).click()
    expect(page.get_by_role('heading',name='Мои проекты')).to_be_visible()
    page.get_by_role('button',name='Вернуть',exact=True).click()
    page.reload()
    stored=page.evaluate('JSON.parse(localStorage.getItem("dolya-crm-v1"))')
    assert len(stored['projects'])==1 and stored['payments'][0]['amount']==12600
    # Small screens: the page itself must never overflow.
    for width in (390,768,1440):
        page.set_viewport_size({'width':width,'height':900})
        page.goto(url.rstrip('/') + '#overview')
        page.wait_for_timeout(150)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'overflow at {width}'
        page.screenshot(path=f'test-results/real-data-{width}.png', full_page=True)
    page.set_viewport_size({'width':390,'height':844})
    page.get_by_role('button',name='Открыть меню',exact=True).click()
    page.get_by_role('link',name='Проекты',exact=True).click()
    expect(page.get_by_role('heading',name='Мои проекты')).to_be_visible()
    expect(page.get_by_role('button',name='Открыть меню',exact=True)).to_be_visible()
    page.get_by_role('button',name='Удалить проект CRM для студии',exact=True).click()
    expect(page.get_by_role('dialog')).to_have_count(0)
    expect(page.get_by_role('button',name='Вернуть',exact=True)).to_be_visible()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'mobile undo overflow'
    page.screenshot(path='test-results/undo-mobile.png', full_page=True)
    page.get_by_role('button',name='Вернуть',exact=True).click()
    expect(page.get_by_role('button',name='CRM для студии',exact=False).first).to_be_visible()
    assert not errors, errors
    print('PASS: project, stage, close, partial payment, persistence, one-click payment deletion and undo, project deletion with receipts and undo, full payment, backup export/import, invalid import, mobile navigation; no JS errors or page overflow at 390/768/1440.')
    browser.close()
