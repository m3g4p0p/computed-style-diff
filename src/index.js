const createStyleLink = (href, onload) => {
  const link = document.createElement('link')

  link.rel = 'stylesheet'
  link.href = href
  link.addEventListener('load', onload)

  return link
}

const toggleStyle = (href, callback) => {
  const link = document.head.querySelector(`[href="${href}"]`)

  if (link) {
    document.head.removeChild(link)
    window.requestAnimationFrame(callback)
  } else {
    document.head.appendChild(createStyleLink(href, callback))
  }
}

const getStyleObject = el => {
  const style = window.getComputedStyle(el)

  return [...style].reduce((res, prop) => ({
    ...res,
    [prop]: style.getPropertyValue(prop)
  }), {})
}

const diffObjects = (a, b, props) => {
  const res = Object.keys({ ...a, ...b })
    .filter(key => (
      !props ||
      props.some(prop => key.indexOf(prop) === 0))
    )
    .reduce((res, prop) => {
      const aVal = a[prop]
      const bVal = b[prop]

      if (aVal !== bVal) {
        res[prop] = [aVal, bVal]
      }

      return res
    }, {})

  return Object.keys(res).length ? res : null
}

const getStyleMap = elements => Array.from(elements).reduce(
  (res, el) => res.set(el, getStyleObject(el)),
  new WeakMap()
)

const getStyleSheet = href => {
  const link = document.createElement('link')

  link.href = href

  return Array.from(document.styleSheets)
    .find(styleSheet => styleSheet.href === link.href)
}

export const getStyleDiff = (href, byCssText) => new Promise(resolve => {
  const elements = document.body.querySelectorAll('*')
  const before = getStyleMap(elements)
  const styleSheet = getStyleSheet(href)

  toggleStyle(href, () => {
    const after = getStyleMap(elements)
    const { cssRules } = styleSheet || getStyleSheet(href)

    const diff = Array
      .from(cssRules, rule => {
        const elements = document.body.querySelectorAll(rule.selectorText)
        return { rule, elements }
      })
      .filter(({ elements }) => elements.length)
      .reduce((res, { rule, elements }) => {
        const props = byCssText && Array.from(rule.style)
        const { cssText, selectorText } = rule

        const diff = Array
          .from(elements, element => ({
            element,
            cssText,
            selectorText,
            changes: diffObjects(
              before.get(element),
              after.get(element),
              props
            )
          }))
          .filter(({ changes }) => changes)

        return res.concat(diff)
      }, [])
      .reduce(byCssText ? (res, { cssText, ...diff }) => {
        res[cssText] = res[cssText] || []
        res[cssText].push(diff)

        return res
      } : (res, { element, cssText, selectorText, changes }) => {
        let entry = null

        if (res[selectorText]) {
          entry = res[selectorText].find(diff => diff.element === element)
        } else {
          res[selectorText] = []
        }

        if (entry) {
          entry.cssText.push(cssText)
          Object.assign(entry.changes, changes)
        } else {
          res[selectorText].push({
            element,
            changes,
            cssText: [cssText]
          })
        }

        return res
      }, {})

    resolve(diff)
  })
})
