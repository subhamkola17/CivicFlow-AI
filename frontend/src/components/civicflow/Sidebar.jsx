function Icon({ children }) {
  return (
    <span
      className="nav-icon"
      aria-hidden="true"
    >
      {children}
    </span>
  );
}


function Sidebar({
  activePage,
  setActivePage,
}) {

  const handleNavigation = (page) => {
    setActivePage(page);
  };


  return (
    <aside className="sidebar">

      {/* BRAND */}

      <div className="brand">

        <div className="brand-mark">
          CF
        </div>

        <div>

          <div className="brand-name">
            CivicFlow AI
          </div>

          <div className="brand-sub">
            Government Operations
          </div>

        </div>

      </div>


      {/* NAVIGATION */}

      <nav
        className="nav"
        aria-label="Main navigation"
      >

        <button
          className={`nav-item ${
            activePage === "dashboard"
              ? "active"
              : ""
          }`}
          onClick={() =>
            handleNavigation("dashboard")
          }
        >
          <Icon>▦</Icon>

          <span>
            Dashboard
          </span>
        </button>


        <button
          className={`nav-item ${
            activePage === "live"
              ? "active"
              : ""
          }`}
          onClick={() =>
            handleNavigation("live")
          }
        >
          <Icon>⌁</Icon>

          <span>
            Live Queues
          </span>
        </button>


        <button
          className={`nav-item ${
            activePage === "analytics"
              ? "active"
              : ""
          }`}
          onClick={() =>
            handleNavigation("analytics")
          }
        >
          <Icon>▥</Icon>

          <span>
            Analytics
          </span>
        </button>


        <button
          className={`nav-item ${
            activePage === "settings"
              ? "active"
              : ""
          }`}
          onClick={() =>
            handleNavigation("settings")
          }
        >
          <Icon>⚙</Icon>

          <span>
            Settings
          </span>
        </button>

      </nav>

    </aside>
  );
}


export default Sidebar;