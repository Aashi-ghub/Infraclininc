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

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
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
              <Link to="/projects" className="text-foreground/80 hover:text-foreground">
                Projects
              </Link>
              <Link to="/geological-log/list" className="text-foreground/80 hover:text-foreground">
                Geological Logs
              </Link>
              {(user.role === "Admin" || user.role === "Project Manager" || user.role === "Site Engineer") && (
                <Link to="/geological-log/create" className="text-foreground/80 hover:text-foreground">
                  Create Log
                </Link>
              )}
              {(user.role === "Admin" || user.role === "Project Manager" || user.role === "Site Engineer" || user.role === "Approval Engineer" || user.role === "Lab Engineer") && (
                <Link to="/workflow/dashboard" className="text-foreground/80 hover:text-foreground">
                  Workflow
                </Link>
              )}
              {(user.role === "Admin" || user.role === "Project Manager") && (
                <Link to="/contacts" className="text-foreground/80 hover:text-foreground">
                  Contacts
                </Link>
              )}
              {user.role === "Admin" && (
                <Link to="/lab-tests/list" className="text-foreground/80 hover:text-foreground">
                  Lab Tests
                </Link>
              )}
              {user.role === "Admin" && (
                <Link to="/users" className="text-foreground/80 hover:text-foreground">
                  Users
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-4">
          {isLoading ? (
            <div className="h-10 w-10 rounded-full bg-muted animate-pulse"></div>
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 rounded-full flex items-center gap-2 px-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline-block">{user.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">
                  {user.email}
                </DropdownMenuLabel>
                <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">
                  Role: {user.role}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user.role === "Admin" && (
                  <DropdownMenuItem asChild>
                    <Link to="/workflow/dashboard" className="flex items-center">
                      <UserIcon className="mr-2 h-4 w-4" />
                      Workflow Dashboard
                    </Link>
                  </DropdownMenuItem>
                )}
                {user.role === "Admin" && (
                  <DropdownMenuItem asChild>
                    <Link to="/reviewer/dashboard" className="flex items-center">
                      <UserIcon className="mr-2 h-4 w-4" />
                      Review Dashboard
                    </Link>
                  </DropdownMenuItem>
                )}
                {user.role === "Admin" && (
                  <DropdownMenuItem asChild>
                    <Link to="/users" className="flex items-center">
                      <UserIcon className="mr-2 h-4 w-4" />
                      User Management
                    </Link>
                  </DropdownMenuItem>
                )}
                {user.role === "Admin" && (
                  <DropdownMenuItem asChild>
                    <Link to="/assignments/create" className="flex items-center">
                      <UserIcon className="mr-2 h-4 w-4" />
                      Project Assignments
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={handleLogin} variant="default">
              Log in
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
} 