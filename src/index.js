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
 * @returns {Promise<void>}
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
 * Toggle style sheets
 *
 * @param {string[]} hrefs
 * @returns {Promise<void>}
 */
const toggleStyles = hrefs => Promise.all(hrefs.map(toggleStyle))

/**
 * Toggle stylesheets; returns a promise that resolves with
 * an array of the CSS rules that were added or removed
 *
 * @param {string[]} hrefs
 * @returns {Promise<CSSRule[]>}
 */
const getToggledRules = hrefs => {
  const styleSheetsBefore = hrefs.map(getStyleSheet)

  return toggleStyles(hrefs).then(() => {
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

  return [...style].reduce((result, prop) => ({
    ...result,
    [prop]: style.getPropertyValue(prop)
  }), {})
}

/**
 * Diff two objects, optionally with an array
 * of properties that should be checked
 *
 * @param {object} a
 * @param {object} b
 * @param {string[]} [props]
 */
const diffObjects = (a, b, props) => {
  const result = Object.keys({ ...a, ...b })
    .filter(key => (
      !props ||
      props.some(prop => key.indexOf(prop) === 0))
    )
    .reduce((result, prop) => {
      const aVal = a[prop]
      const bVal = b[prop]

      if (aVal !== bVal) {
        result[prop] = [aVal, bVal]
      }

      return result
    }, {})

  return Object.keys(result).length ? result : null
}

/**
 * Map elements to the associated style objects
 *
 * @param {NodeList} elements
 * @returns {WeakMap}
 */
const getStyleMap = elements => Array.from(elements).reduce(
  (result, el) => result.set(el, getStyleObject(el)),
  new WeakMap()
)

/**
 * Push an element to an array if the array does not
 * yet include that element
 *
 * @param {Array} array
 * @param {any} element
 */
const pushUnique = (array, element) => {
  if (array.indexOf(element) === -1) {
    array.push(element)
  }

  return array
}

/**
 * Get a dictionary of styles that changed by toggling the
 * specified stylesheets
 *
 * @param {string[]} hrefs
 * @param {object} [options]
 * @param {boolean} [options.rulePropsOnly = true]
 * @param {boolean} [options.squash = true]
 * @returns {Promise<object>}
 */
const getStyleDiff = (hrefs, {
  breakpoints,
  ...options
} = {}) => {
  if (breakpoints) {
    return getStyleDiffs(hrefs, breakpoints, options)
  }

  const {
    rulePropsOnly = true,
    squash = true
  } = options

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
      .reduce((result, { rule, elements }) => {
        const { cssText, selectorText } = rule

        const diff = Array
          .from(elements, element => ({
            element,
            cssText,
            selectorText,
            changes: diffObjects(
              before.get(element),
              after.get(element),
              rulePropsOnly && Array.from(rule.style)
            )
          }))
          .filter(({ changes }) => changes)

        return result.concat(diff)
      }, [])
      .reduce(squash ? (result, {
        selectorText,
        cssText,
        element,
        changes
      }) => {
        result[selectorText] = result[selectorText] || {
          elements: [],
          cssText: [],
          changes: {}
        }

        pushUnique(result[selectorText].elements, element)
        pushUnique(result[selectorText].cssText, cssText)
        Object.assign(result[selectorText].changes, changes)

        return result
      } : (result, {
        selectorText,
        ...diff
      }) => {
        result[selectorText] = result[selectorText] || []
        result[selectorText].push(diff)

        return result
      }, {})
  })
}

const nextFrame = () => new Promise(resolve => {
  window.requestAnimationFrame(resolve)
})

const getStyleDiffs = async (hrefs, breakpoints, options) => {
  const result = {}

  while (breakpoints.length) {
    const [breakpoint, ...remaining] = breakpoints

    breakpoints = remaining
    window.resizeTo(breakpoint, window.outerHeight)
    await nextFrame()
    result[breakpoint] = await getStyleDiff(hrefs, options)
    await toggleStyles(hrefs)
  }

  return result
}

/**
 * Toggle style sheets and generate a CSS text that would revert the
 * effects this had on the page
 *
 * @param {string[]} hrefs
 * @returns {Promise<string>}
 */
const generateCounterCSS = hrefs => getStyleDiff(hrefs).then(diff => {
  return Object.entries(diff).map(([selectorText, { changes }]) => {
    const rules = Object
      .entries(changes)
      .map(([prop, [value]]) => `  ${prop}: ${value};`)
      .join('\n')

    return `${selectorText} {\n${rules}\n}`
  }).join('\n\n')
})

export {
  toggleStyles,
  getStyleDiff,
  generateCounterCSS
}
