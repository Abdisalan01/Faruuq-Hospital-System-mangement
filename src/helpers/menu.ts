import { getCookie } from 'cookies-next'
import type { MenuItemType } from '@/types/menu'
import { HMS_MENU_ITEMS, filterMenuByPermissions } from '@/shared/config/hmsMenu'
import { roleHasAnyPermission } from '@/shared/types/roles'
import type { UserRole } from '@/shared/types/roles'

const authSessionKey = '_Rasket_AUTH_KEY_'

function getCurrentUserRole(): UserRole | undefined {
  const fetchedCookie = getCookie(authSessionKey)?.toString()
  if (!fetchedCookie) return undefined
  try {
    const user = JSON.parse(fetchedCookie)
    return user.role as UserRole
  } catch {
    return undefined
  }
}

export const getMenuItems = (): MenuItemType[] => {
  const role = getCurrentUserRole()
  if (!role) {
    return HMS_MENU_ITEMS.filter((item) => item.key === 'hms-title' || item.key === 'hms-dashboard')
  }
  return filterMenuByPermissions(HMS_MENU_ITEMS, (permissions) => roleHasAnyPermission(role, permissions), role)
}

export const findAllParent = (menuItems: MenuItemType[], menuItem: MenuItemType): string[] => {
  let parents: string[] = []
  const parent = findMenuItem(menuItems, menuItem.parentKey)
  if (parent) {
    parents.push(parent.key)
    if (parent.parentKey) {
      parents = [...parents, ...findAllParent(menuItems, parent)]
    }
  }
  return parents
}

export const getMenuItemFromURL = (items: MenuItemType | MenuItemType[], url: string): MenuItemType | undefined => {
  if (items instanceof Array) {
    for (const item of items) {
      const foundItem = getMenuItemFromURL(item, url)
      if (foundItem) return foundItem
    }
  } else {
    if (items.url == url) return items
    if (items.children != null) {
      for (const item of items.children) {
        if (item.url == url) return item
      }
    }
  }
}

export const findMenuItem = (menuItems: MenuItemType[] | undefined, menuItemKey: MenuItemType['key'] | undefined): MenuItemType | null => {
  if (menuItems && menuItemKey) {
    for (const item of menuItems) {
      if (item.key === menuItemKey) return item
      const found = findMenuItem(item.children, menuItemKey)
      if (found) return found
    }
  }
  return null
}
