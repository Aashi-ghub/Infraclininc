import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "./button";
import { Avatar, AvatarFallback } from "./avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { LogOut, User as UserIcon } from "lucide-react";

export function Navbar() {
  const { user, logout, isLoading } = useAuth();
  const navigate = useNavigate();

  const getInitials = (name: string) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const handleLogout = () => {
    logout();
    navigate("/auth/login");
  };

  const handleLogin = () => {
    navigate("/auth/login");
  };

  return (
    <nav className="border-b bg-background">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <Link to="/" className="text-xl font-bold">
            BackendBore
          </Link>
          
          {user && (
            <div className="hidden md:flex space-x-4">
              {/* Projects - All roles except Lab Engineer */}
              {(user.role !== "Lab Engineer") && (
                <Link to="/projects" className="text-foreground/80 hover:text-foreground">
                  Projects
                </Link>
              )}
              
              {/* Geological Logs - All roles except Lab Engineer */}
              {(user.role !== "Lab Engineer") && (
                <Link to="/geological-log/list" className="text-foreground/80 hover:text-foreground">
                  Geological Logs
                </Link>
              )}
              
              {/* Create Log - Admin, Project Manager, Site Engineer */}
              {(user.role === "Admin" || user.role === "Project Manager" || user.role === "Site Engineer") && (
                <Link to="/geological-log/create" className="text-foreground/80 hover:text-foreground">
                  Create Log
                </Link>
              )}
              
              {/* Workflow - All roles except Lab Engineer */}
              {(user.role !== "Lab Engineer") && (
                <Link to="/workflow/dashboard" className="text-foreground/80 hover:text-foreground">
                  Workflow
                </Link>
              )}
              
              {/* Lab Reports - Admin and Lab Engineer */}
              {(user.role === "Admin" || user.role === "Lab Engineer") && (
                <Link to="/lab-reports" className="text-foreground/80 hover:text-foreground">
                  Lab Reports
                </Link>
              )}
              
              {/* Contacts - Admin and Project Manager */}
              {(user.role === "Admin" || user.role === "Project Manager") && (
                <Link to="/contacts" className="text-foreground/80 hover:text-foreground">
                  Contacts
                </Link>
              )}
              
              {/* Lab Tests - Admin only */}
              {user.role === "Admin" && (
                <Link to="/lab-tests/list" className="text-foreground/80 hover:text-foreground">
                  Lab Tests
                </Link>
              )}
              
              {/* User Management - Admin only */}
              {user.role === "Admin" && (
                <Link to="/users" className="text-foreground/80 hover:text-foreground">
                  Users
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-4">
          {user ? (
            <>
              <div className="hidden md:flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">
                  {user.name}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                  {user.role}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                disabled={isLoading}
              >
                {isLoading ? "Logging out..." : "Logout"}
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={handleLogin}>
              Login
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
} 