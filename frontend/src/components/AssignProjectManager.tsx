import { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { assignmentApi, userApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface User {
  user_id: string;
  name: string;
  email: string;
  role: string;
}

interface AssignProjectManagerProps {
  projectId: string;
  projectName: string;
  assignedManager?: {
    user_id: string;
    name: string;
    email: string;
  };
  onAssignmentComplete?: () => void;
}

export function AssignProjectManager({ projectId, projectName, assignedManager, onAssignmentComplete }: AssignProjectManagerProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [projectManagers, setProjectManagers] = useState<User[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadProjectManagers = async () => {
      try {
        const response = await userApi.list();
        // Filter users to only show Project Managers
        const managers = response.data.data.filter(
          (user: User) => user.role === 'Project Manager'
        );
        setProjectManagers(managers);
      } catch (error) {
        console.error('Failed to load project managers:', error);
        toast({
          title: 'Error',
          description: 'Failed to load project managers. Please try again.',
          variant: 'destructive',
        });
      }
    };

    if (isOpen) {
      loadProjectManagers();
    }
  }, [isOpen, toast]);

  const handleAssign = async () => {
    if (!selectedManagerId) {
      toast({
        title: 'Error',
        description: 'Please select a project manager.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsLoading(true);
      await assignmentApi.assignUsers({
        project_id: projectId,
        assignment_type: 'AdminToManager',
        assigner: [], // Will be filled with the current user's ID by the backend
        assignee: [selectedManagerId],
      });

      toast({
        title: 'Success',
        description: 'Project manager assigned successfully.',
      });

      setIsOpen(false);
      if (onAssignmentComplete) {
        onAssignmentComplete();
      }
    } catch (error) {
      console.error('Failed to assign project manager:', error);
      toast({
        title: 'Error',
        description: 'Failed to assign project manager. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {assignedManager ? (
          <Button variant="secondary" size="sm" className="flex-1">
            <Users className="h-4 w-4 mr-2" />
            {assignedManager.name}
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="flex-1">
            <Users className="h-4 w-4 mr-2" />
            Assign Manager
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Project Manager</DialogTitle>
          <DialogDescription>
            Select a project manager to assign to {projectName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Select
            value={selectedManagerId}
            onValueChange={setSelectedManagerId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a project manager" />
            </SelectTrigger>
            <SelectContent>
              {projectManagers.map((manager) => (
                <SelectItem key={manager.user_id} value={manager.user_id}>
                  {manager.name} ({manager.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={isLoading || !selectedManagerId}
            >
              {isLoading ? 'Assigning...' : 'Assign Manager'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}