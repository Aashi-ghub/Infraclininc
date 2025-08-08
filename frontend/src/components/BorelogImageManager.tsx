import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { borelogImagesApi } from '@/lib/api';
import FileUpload from './FileUpload';
import { Trash2, Image as ImageIcon } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BorelogImage {
  image_id: string;
  image_url: string;
  uploaded_at: string;
}

interface BorelogImageManagerProps {
  borelogId: string;
  onImagesChange?: () => void;
}

export function BorelogImageManager({ borelogId, onImagesChange }: BorelogImageManagerProps) {
  const [images, setImages] = useState<BorelogImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<BorelogImage | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();

  // Fetch existing images
  const fetchImages = async () => {
    try {
      setIsLoading(true);
      const response = await borelogImagesApi.getByBorelogId(borelogId);
      setImages(response.data.data);
    } catch (error) {
      console.error('Error fetching images:', error);
      toast({
        title: 'Error',
        description: 'Failed to load images',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, [borelogId]);

  const handleFilesChange = async (files: File[]) => {
    for (const file of files) {
      try {
        // Here you would typically upload to your storage service (S3, etc)
        // For now, we'll use a placeholder URL
        const image_url = URL.createObjectURL(file);
        
        // Upload to API
        await borelogImagesApi.upload({
          borelog_id: borelogId,
          image_url,
        });

        // Refresh images
        fetchImages();
        onImagesChange?.();

        toast({
          title: 'Success',
          description: 'Image uploaded successfully',
        });
      } catch (error) {
        console.error('Error uploading image:', error);
        toast({
          title: 'Error',
          description: 'Failed to upload image',
          variant: 'destructive',
        });
      }
    }
  };

  const handleDelete = async () => {
    if (!selectedImage) return;

    try {
      await borelogImagesApi.delete(selectedImage.image_id);
      setImages(images.filter(img => img.image_id !== selectedImage.image_id));
      onImagesChange?.();
      
      toast({
        title: 'Success',
        description: 'Image deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting image:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete image',
        variant: 'destructive',
      });
    } finally {
      setShowDeleteDialog(false);
      setSelectedImage(null);
    }
  };

  return (
    <div className="space-y-4">
      <FileUpload
        onFilesChange={handleFilesChange}
        accept="image/*"
        multiple={true}
        maxFiles={5}
        maxSize={5} // 5MB
      />

      {/* Image Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map((image) => (
          <Card key={image.image_id} className="relative group">
            <div className="aspect-square relative">
              <img
                src={image.image_url}
                alt="Borelog"
                className="absolute inset-0 w-full h-full object-cover rounded-t-lg"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setSelectedImage(image);
                    setShowDeleteDialog(true);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {/* Empty State */}
        {!isLoading && images.length === 0 && (
          <Card className="col-span-full p-8 text-center text-muted-foreground">
            <ImageIcon className="h-12 w-12 mx-auto mb-4" />
            <p>No images uploaded yet</p>
          </Card>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Image</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this image? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}