import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { contactApi } from '@/lib/api';
import { Contact } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader } from '@/components/Loader';
import { ProtectedRoute } from '@/lib/authComponents';
import { Badge } from '@/components/ui/badge';

export default function ContactsListPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        setLoading(true);
        const response = await contactApi.list();
        console.log('Contacts response:', response);
        
        if (response.data && Array.isArray(response.data.data)) {
          setContacts(response.data.data);
          setFilteredContacts(response.data.data);
        } else if (response.data && Array.isArray(response.data)) {
          setContacts(response.data);
          setFilteredContacts(response.data);
        } else {
          console.error('Unexpected response format:', response);
          setContacts([]);
          setFilteredContacts([]);
        }
      } catch (error) {
        console.error('Error fetching contacts:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch contacts. Please try again.',
          variant: 'destructive',
        });
        setContacts([]);
        setFilteredContacts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchContacts();
  }, [toast]);

  // Apply search filter
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredContacts(contacts);
      return;
    }

    const filtered = contacts.filter(contact =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.role.toLowerCase().includes(searchQuery.toLowerCase())
    );

    setFilteredContacts(filtered);
  }, [contacts, searchQuery]);

  const handleDeleteContact = async (contactId: string) => {
    if (!window.confirm('Are you sure you want to delete this contact?')) {
      return;
    }

    try {
      await contactApi.delete(contactId);
      
      toast({
        title: 'Success',
        description: 'Contact deleted successfully',
      });
      
      // Remove the deleted contact from the state
      setContacts(prevContacts => 
        prevContacts.filter(contact => contact.contact_id !== contactId)
      );
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete contact. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'Admin':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Project Manager':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Site Engineer':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Supervisor':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'QA/QC':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <ProtectedRoute>
      <div className="container mx-auto py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold">Contacts</h1>
            <p className="text-muted-foreground">
              Manage your project contacts and team members
            </p>
          </div>
          <Button className="bg-gradient-to-r from-primary to-primary-glow hover:shadow-elegant transition-all duration-300" asChild>
            <Link to="/contacts/create">
              <Plus className="h-4 w-4 mr-2" />
              Add New Contact
            </Link>
          </Button>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts by name or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Contact List
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader size="lg" />
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No contacts found</h3>
                <p className="text-muted-foreground mb-4">
                  {contacts.length === 0 
                    ? 'You haven\'t added any contacts yet.'
                    : 'No contacts match your search criteria.'
                  }
                </p>
                <Button asChild>
                  <Link to="/contacts/create">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Contact
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Organization</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContacts.map((contact) => (
                      <TableRow key={contact.contact_id}>
                        <TableCell className="font-medium">{contact.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getRoleBadgeColor(contact.role)}>
                            {contact.role}
                          </Badge>
                        </TableCell>
                        <TableCell>{contact.organisation_id}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" asChild>
                              <Link to={`/contacts/${contact.contact_id}`}>
                                View
                              </Link>
                            </Button>
                            <Button variant="outline" size="sm" asChild>
                              <Link to={`/contacts/edit/${contact.contact_id}`}>
                                Edit
                              </Link>
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => handleDeleteContact(contact.contact_id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
} 