/**
 * Create a stylesheet link
 *
 * @param {string} href
 * @param {function} onload
 * @returns {HTMLElement}
 */
const createStyleLink = (href, onload) => {
  const link = document.createElement('link')

  link.rel = 'stylesheet'
  link.href = href
  link.addEventListener('load', onload)

  return link
}

/**
 * Append or remove a stylesheet link with a given href
 *
 * @param {string} href
 * @returns {Promise}
 */
const toggleStyle = href => new Promise(resolve => {
  const link = document.head.querySelector(`[href="${href}"]`)

  if (link) {
    document.head.removeChild(link)
    window.requestAnimationFrame(resolve)
  } else {
    document.head.appendChild(createStyleLink(href, resolve))
  }
})

/**
 * Get the stylesheet from a given link
 *
 * @param {string} href
 * @returns {CSSStyleSheet}
 */
const getStyleSheet = href => {
  const link = document.createElement('link')

  link.href = href

  return Array.from(document.styleSheets)
    .find(styleSheet => styleSheet.href === link.href)
}

/**
 * Toggle stylesheets; returns a promise that resolves with
 * an array of the CSS rules that were added or removed
 *
 * @param {string[]} hrefs
 * @returns {Promise<CSSRule[]>}
 */
const getToggledRules = hrefs => {
  const styleSheetsBefore = hrefs.map(getStyleSheet)

  return Promise.all(hrefs.map(toggleStyle)).then(() => {
    const styleSheetsAfter = hrefs.map(getStyleSheet)

    return [...styleSheetsBefore, ...styleSheetsAfter]
      .filter(styleSheet => styleSheet)
      .reduce((cssRules, styleSheet) => cssRules.concat([...styleSheet.cssRules]), [])
  })
}

/**
 * Get the computed style for an element and convert
 * it to an object that is easier to work with
 *
 * @param {HTMLElement} el
 * @returns {object}
 */
const getStyleObject = el => {
  const style = window.getComputedStyle(el)

  return [...style].reduce((res, prop) => ({
    ...res,
    [prop]: style.getPropertyValue(prop)
  }), {})
}

/**
 * Diff two objects, optionally with an array
 * of properties that should be checked
 *
 * @param {object} a
 * @param {object} b
 * @param {string[]?} props
 */
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

/**
 * Map elements to the associated style objects
 *
 * @param {NodeList} elements
 * @returns {WeakMap}
 */
const getStyleMap = elements => Array.from(elements).reduce(
  (res, el) => res.set(el, getStyleObject(el)),
  new WeakMap()
)

/**
 * Get a dictionary of styles that changed by toggling the
 * specified stylesheets
 *
 * @param {string[]} hrefs
 * @param {boolean?} rulesOnly
 * @returns {Promise<object>}
 */
export const getStyleDiff = (hrefs, rulesOnly) => {
  const elements = document.body.querySelectorAll('*')
  const before = getStyleMap(elements)

  return getToggledRules(hrefs).then(cssRules => {
    const after = getStyleMap(elements)

    return Array
      .from(cssRules, rule => {
        const elements = document.body.querySelectorAll(rule.selectorText)
        return { rule, elements }
      })
      .filter(({ elements }) => elements.length)
      .reduce((res, { rule, elements }) => {
        const { cssText, selectorText } = rule

        const diff = Array
          .from(elements, element => ({
            element,
            cssText,
            selectorText,
            changes: diffObjects(
              before.get(element),
              after.get(element),
              rulesOnly && Array.from(rule.style)
            )
          }))
          .filter(({ changes }) => changes)

        return res.concat(diff)
      }, [])
      .reduce((res, {
        element,
        cssText,
        selectorText,
        changes
      }) => {
        res[selectorText] = res[selectorText] || {
          elements: new Set(),
          rules: new Set(),
          changes: {}
        }

        res[selectorText].elements.add(element)
        res[selectorText].rules.add(cssText)
        Object.assign(res[selectorText].changes, changes)

        return res
      }, {})
  })
}
