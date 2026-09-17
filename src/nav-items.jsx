import { HomeIcon } from "lucide-react";
import Index from "./pages/Index.jsx";
import Admin from "./pages/Admin.jsx";

/**
 * Central place for defining the navigation items. Used for navigation components and routing.
 */
export const navItems = [
  {
    title: "Home",
    to: "/",
    icon: <HomeIcon className="h-4 w-4" />,
    page: <Index />,
  },
  {
    title: "Post",
    to: "/post/:slug",
    icon: <HomeIcon className="h-4 w-4" />,
    page: <Index />,
  },
  {
    title: "Admin",
    to: "/admin",
    icon: <HomeIcon className="h-4 w-4" />,
    page: <Admin />,
  },
  {
    title: "Admin Editor",
    to: "/admin/:id",
    icon: <HomeIcon className="h-4 w-4" />,
    page: <Admin />,
  },
];
