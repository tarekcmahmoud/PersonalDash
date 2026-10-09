import {
  CalendarDays,
  FileText,
  FolderKanban,
  History,
  UsersRound,
  Inbox,
  ListChecks,
  Settings,
  Sun,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Left of the dock's divider and on the phone bottom bar; the rest sit right of the divider / under "More". */
  primary: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Today', icon: Sun, primary: true },
  { to: '/week', label: 'Week', icon: CalendarDays, primary: true },
  { to: '/plan', label: 'Plan', icon: ListChecks, primary: true },
  { to: '/projects', label: 'Projects', icon: FolderKanban, primary: true },
  { to: '/inbox', label: 'Inbox', icon: Inbox, primary: false },
  { to: '/delegated', label: 'Delegated', icon: UsersRound, primary: false },
  { to: '/review', label: 'Weekly review', icon: History, primary: false },
  { to: '/templates', label: 'Templates', icon: FileText, primary: false },
  { to: '/settings', label: 'Settings', icon: Settings, primary: false },
]
