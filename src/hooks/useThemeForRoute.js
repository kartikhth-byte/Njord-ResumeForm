import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { applyTheme, themeForPath } from '../lib/theme'

export function useThemeForRoute() {
  const { pathname } = useLocation()
  useLayoutEffect(() => {
    applyTheme(themeForPath(pathname))
  }, [pathname])
}

export function useTheme(theme) {
  useLayoutEffect(() => {
    applyTheme(theme)
  }, [theme])
}
