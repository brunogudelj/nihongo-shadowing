// @vitest-environment happy-dom
// Kartica riječi s kanjijima (dugi pritisak): cijela riječ gore, kanjiji ispod. Pokretanje: npm test
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'
import { KanjiMagnifier, KanjiText } from './Kanji'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function longPress(el: Element) {
  await act(async () => {
    el.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }))
    await wait(450)
    el.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', bubbles: true }))
  })
}

async function render(node: React.ReactNode) {
  const el = document.createElement('div')
  document.body.append(el)
  const root = createRoot(el)
  await act(async () => root.render(<KanjiMagnifier>{node}</KanjiMagnifier>))
  const text = () => el.textContent ?? ''
  const until = async (cond: () => boolean) => {
    for (let i = 0; i < 40 && !cond(); i++) await act(() => wait(50))
  }
  return { el, root, text, until }
}

it('dugi pritisak na kanji u riječi pokaže cijelu riječ, a dodir na kanji njegove detalje', async () => {
  const { el, root, text, until } = await render(
    <KanjiText text="九州" word={{ text: '九州', reading: 'きゅうしゅう', romaji: 'kyūshū', meaning: 'Kyushu, japanski otok na jugozapadu.' }} />,
  )
  const shu = [...el.querySelectorAll('span')].find((s) => s.textContent === '州')!
  await longPress(shu)
  await until(() => text().includes('Kanjiji u riječi'))
  expect(text()).toContain('Kyushu, japanski otok na jugozapadu.')
  expect(text()).toContain('kyūshū')
  expect(text()).not.toContain('On:') // detalji tek na dodir

  const chip = [...el.querySelectorAll('button')].find((b) => b.textContent?.startsWith('州'))!
  await act(async () => chip.click())
  await until(() => text().includes('On:'))
  expect(text()).toContain('しゅう')
  act(() => root.unmount())
})

it('riječ s jednim kanjijem odmah pokaže i njegove detalje', async () => {
  const { el, root, text, until } = await render(<KanjiText text="駅" word={{ text: '駅', reading: 'えき', meaning: 'postaja' }} />)
  await longPress([...el.querySelectorAll('span')].find((s) => s.textContent === '駅')!)
  await until(() => text().includes('On:'))
  expect(text()).toContain('postaja')
  expect(text()).not.toContain('Kanjiji u riječi')
  act(() => root.unmount())
})
