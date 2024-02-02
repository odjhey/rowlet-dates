import './App.css'
import { Hours } from './components/Hours'
import {
  Link,
  Outlet,
  RouterProvider,
  createBrowserRouter,
} from 'react-router-dom'
import { DateDiff } from './components/DateDiff'

const Root = () => {
  return (
    <>
      <nav className="navbar">
        <ul className="menu menu-horizontal">
          <li>
            <Link to={`/hours`}>Hours</Link>
          </li>
          <li>
            <Link to={`/diff`}>Diff</Link>
          </li>
          <li>
            <Link to={`/about`}>About</Link>
          </li>
        </ul>
      </nav>
      <Outlet />
    </>
  )
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Root />,
    children: [
      {
        path: '/about',
        element: <div>ei!</div>,
      },
      {
        path: '/diff',
        element: <DateDiff></DateDiff>,
      },
      {
        path: '/hours',
        element: <Hours />,
      },
    ],
  },
])

const Shell = () => <RouterProvider router={router} />

export default Shell
