import './App.css'
import { Hours } from './components/Hours'
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  RouterProvider,
  createBrowserRouter,
  useLocation,
} from 'react-router-dom'
import { DateDiff } from './components/DateDiff'

const navItems = [
  { to: '/hours', label: 'Hours' },
  { to: '/diff', label: 'Diff' },
  { to: '/about', label: 'About' },
]

const Root = () => {
  const { pathname } = useLocation()
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <nav className="app-nav" aria-label="Main">
        <ul>
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to}>{item.label}</NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main id="main" className="app-main" tabIndex={-1}>
        {/* Keep tool drafts mounted across navigation; only snapshots survive a reload. */}
        <div hidden={pathname !== '/hours'}>
          <Hours />
        </div>
        <div hidden={pathname !== '/diff'}>
          <DateDiff />
        </div>
        <Outlet />
      </main>
    </>
  )
}

const About = () => {
  return (
    <div className="about">
      <h1 className="page-title">About</h1>
      <h2 className="panel-title">Hours</h2>
      <p>
        Write one activity per line, like{' '}
        <code className="mono">09:00-10:30 Write notes</code>, or edit the
        start, end and description fields. The timeline sets the start or end of
        an activity; use the time fields for exact minutes.
      </p>
      <p>
        Durations are the gap between two times on the same day. An end before
        the start is not treated as overnight. The date and timezone are labels
        only; times are not converted.
      </p>
      <p>
        Current drafts, including unapplied text, are saved automatically in
        this browser. Save keeps a separate snapshot you can return to. Clearing
        site data removes drafts and snapshots.
      </p>
      <h2 className="panel-title">Diff</h2>
      <p>
        Count trip dates with both start and end included. Weekends mean
        Saturday and Sunday. An optional day limit compares the whole trip with
        a number you enter; it does not check destination visa rules or rolling
        windows. Marking dates does not shorten the trip. Dates, limits and
        marks are saved in this browser. Public holidays are not included.
      </p>
    </div>
  )
}

const NotFound = () => {
  return (
    <div className="not-found">
      <h1 className="page-title">Page not found</h1>
      <p>
        Go to <Link to="/hours">Hours</Link> or <Link to="/diff">Diff</Link>.
      </p>
    </div>
  )
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Root />,
    children: [
      {
        index: true,
        element: <Navigate to="/hours" replace />,
      },
      {
        path: 'hours',
        element: null,
      },
      {
        path: 'diff',
        element: null,
      },
      {
        path: 'about',
        element: <About />,
      },
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
])

const Shell = () => <RouterProvider router={router} />

export default Shell
