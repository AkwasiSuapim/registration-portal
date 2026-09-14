/* -------------------------------------------------------
   WorkspaceNav — section navigation shared by every workspace shell
   (Student Workspace, Official Workspace). Renders as a sticky sidebar
   on desktop and a bottom tab bar on mobile (pure CSS breakpoint, no
   layout JS needed); both are built from the same item list so they
   never drift apart.

   `items` defaults to the Student Workspace's own tabs so its existing
   call site (StudentPortal.jsx) is unaffected — pass a different list
   (e.g. the Official Workspace's Dashboard / Review History tabs) to
   reuse this same component elsewhere instead of duplicating it.
------------------------------------------------------- */

const WORKSPACE_TABS = [
  { key: 'overview',     label: 'Overview'     },
  { key: 'registration', label: 'Registration' },
  { key: 'clearances',   label: 'Clearances'   },
  { key: 'documents',    label: 'Documents'    },
  { key: 'activity',     label: 'Activity'     },
  { key: 'help',         label: 'Help'         },
]

function NavButton({ item, active, disabled, badgeCount, onSelect }) {
  return (
    <button
      type="button"
      className={`workspace-nav__item${active ? ' workspace-nav__item--active' : ''}`}
      aria-current={active ? 'page' : undefined}
      disabled={disabled}
      title={disabled ? 'Submit a registration to unlock this section.' : undefined}
      onClick={() => onSelect(item.key)}
    >
      <span className="workspace-nav__dot" aria-hidden="true"></span>
      <span className="workspace-nav__label">{item.label}</span>
      {badgeCount > 0 && (
        <span className="workspace-nav__badge">{badgeCount}</span>
      )}
    </button>
  )
}

function WorkspaceNav({
  activeTab, onSelect, actionCount = 0, disabledTabs = [],
  items = WORKSPACE_TABS, badgeKey = 'clearances',
  label = 'Student sections', heading = 'Registration',
}) {
  const renderItem = (item) => (
    <NavButton
      key={item.key}
      item={item}
      active={activeTab === item.key}
      disabled={disabledTabs.includes(item.key)}
      badgeCount={item.key === badgeKey ? actionCount : 0}
      onSelect={onSelect}
    />
  )

  return (
    <>
      <nav aria-label={label} className="workspace-sidebar">
        <span className="workspace-sidebar__heading">{heading}</span>
        {items.map(renderItem)}
      </nav>

      <nav aria-label={label} className="workspace-bottomnav">
        {items.map(renderItem)}
      </nav>
    </>
  )
}

export default WorkspaceNav
