import {
  CalendarIcon,
  ChecklistIcon,
  FileIcon,
  GearIcon,
  HistoryIcon,
  HomeIcon,
  InboxIcon,
  ProjectIcon,
  type Icon,
} from '@primer/octicons-react'

export interface NavItem {
  to: string
  label: string
  icon: Icon
  /** Shown in the phone bottom bar (others go under "More"). */
  primary: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Today', icon: HomeIcon, primary: true },
  { to: '/week', label: 'Week', icon: CalendarIcon, primary: true },
  { to: '/plan', label: 'Plan', icon: ChecklistIcon, primary: true },
  { to: '/projects', label: 'Projects', icon: ProjectIcon, primary: true },
  { to: '/inbox', label: 'Inbox', icon: InboxIcon, primary: false },
  { to: '/review', label: 'Weekly review', icon: HistoryIcon, primary: false },
  { to: '/templates', label: 'Templates', icon: FileIcon, primary: false },
  { to: '/settings', label: 'Settings', icon: GearIcon, primary: false },
]
