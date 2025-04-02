import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { FaMap, FaDatabase, FaCalendarAlt, FaListAlt, FaNewspaper, FaLocationArrow } from 'react-icons/fa';

const MainLayout = () => {
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white shadow-md">
        <div className="p-4 border-b">
          <h1 className="text-2xl font-bold text-primary-600">News Catcher</h1>
          <p className="text-sm text-gray-500">Hyper-local news visualization</p>
        </div>
        
        <nav className="p-4">
          <ul className="space-y-2">
            {/* Featured Huntington Link */}
            <li className="mb-4">
              <NavLink 
                to="/huntington" 
                className={({ isActive }) => 
                  `flex items-center p-3 rounded-lg ${isActive ? 'bg-green-100 text-green-700 font-medium' : 'bg-green-50 text-green-600 hover:bg-green-100'} border border-green-200`
                }
              >
                <FaLocationArrow className="mr-2" />
                <span>
                  <span className="font-semibold">Huntington, NY</span>
                  <span className="block text-xs">Local News & Events</span>
                </span>
              </NavLink>
            </li>
            
            <li>
              <NavLink 
                to="/" 
                className={({ isActive }) => 
                  `flex items-center p-2 rounded-lg ${isActive ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`
                }
                end
              >
                <FaMap className="mr-3" />
                Map View
              </NavLink>
            </li>
            <li>
              <NavLink 
                to="/sources" 
                className={({ isActive }) => 
                  `flex items-center p-2 rounded-lg ${isActive ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`
                }
              >
                <FaDatabase className="mr-3" />
                Data Sources
              </NavLink>
            </li>
            <li>
              <NavLink 
                to="/events" 
                className={({ isActive }) => 
                  `flex items-center p-2 rounded-lg ${isActive ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`
                }
              >
                <FaCalendarAlt className="mr-3" />
                Events
              </NavLink>
            </li>
            <li>
              <NavLink 
                to="/logs" 
                className={({ isActive }) => 
                  `flex items-center p-2 rounded-lg ${isActive ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`
                }
              >
                <FaListAlt className="mr-3" />
                Logs
              </NavLink>
            </li>
          </ul>
        </nav>
        
        <div className="absolute bottom-0 w-64 p-4 border-t bg-white">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} News Catcher
            <br />
            Internal use only
          </p>
        </div>
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
