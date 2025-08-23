import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Project, Structure, Substructure } from '../components/types';

interface SimplifiedProjectInfoProps {
  projects: Project[];
  structures: Structure[];
  substructures: Substructure[];
  canEdit: boolean;
  form: any;
}

export function SimplifiedProjectInfo({
  projects,
  structures,
  substructures,
  canEdit,
  form
}: SimplifiedProjectInfoProps) {
  const { register } = useFormContext();

  return (
    <div className="space-y-6">

      {/* Project, Structure, Substructure Selection Row */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="project_name">Project Name:</Label>
          <Select
            disabled={!canEdit}
            onValueChange={(value) => form.setValue('project_id', value)}
            value={form.watch('project_id')}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.project_id} value={project.project_id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="structure_id">Structure</Label>
          <Select
            disabled={!canEdit || !form.watch('project_id')}
            onValueChange={(value) => form.setValue('structure_id', value)}
            value={form.watch('structure_id') || ''}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select structure" />
            </SelectTrigger>
            <SelectContent>
              {structures.map((structure) => (
                <SelectItem key={structure.structure_id} value={structure.structure_id}>
                  {structure.type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="substructure_id">Substructure</Label>
          <Select
            disabled={!canEdit || !form.watch('structure_id')}
            onValueChange={(value) => form.setValue('substructure_id', value)}
            value={form.watch('substructure_id') || ''}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select substructure" />
            </SelectTrigger>
            <SelectContent>
              {substructures.map((s) => (
                <SelectItem key={s.substructure_id} value={s.substructure_id}>
                  {s.type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Form Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="job_code">Job Code</Label>
            <Input
              {...register('job_code')}
              disabled={!canEdit}
              className="bg-yellow-50"
            />
          </div>
          <div>
            <Label htmlFor="chainage_km">Chainage (Km)</Label>
            <Input
              {...register('chainage_km')}
              disabled={!canEdit}
              className="bg-yellow-50"
            />
          </div>
          <div>
            <Label htmlFor="borehole_number">Borehole No.</Label>
            <Input
              {...register('borehole_number')}
              disabled={!canEdit}
              className="bg-yellow-50"
            />
          </div>
          <div>
            <Label htmlFor="msl">Mean Sea Level (MSL)</Label>
            <Input
              {...register('msl')}
              disabled={!canEdit}
              className="bg-yellow-50"
            />
          </div>
          <div>
            <Label htmlFor="method_of_boring">Method of Boring / Drilling</Label>
            <Input
              {...register('method_of_boring')}
              disabled={!canEdit}
              defaultValue="Rotary Drilling"
              className="bg-gray-100"
            />
          </div>
          <div>
            <Label htmlFor="diameter_of_hole">Diameter of Hole</Label>
            <Input
              {...register('diameter_of_hole')}
              disabled={!canEdit}
              defaultValue="150 mm"
              className="bg-gray-100"
            />
          </div>
        </div>

        {/* Middle Column */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="section_name">Section Name</Label>
            <Input
              {...register('section_name')}
              disabled={!canEdit}
              defaultValue="CNE-AGTL"
              className="bg-gray-100"
            />
          </div>
          <div>
            <Label htmlFor="location">Location</Label>
            <Input
              {...register('location')}
              disabled={!canEdit}
              defaultValue="BR-365 (STEEL GIDER)"
              className="bg-gray-100"
            />
          </div>
          <div>
            <Label htmlFor="commencement_date">Commencement Date</Label>
            <Input
              type="date"
              {...register('commencement_date')}
              disabled={!canEdit}
              className="bg-gray-100"
            />
          </div>
          <div>
            <Label htmlFor="completion_date">Completion Date</Label>
            <Input
              type="date"
              {...register('completion_date')}
              disabled={!canEdit}
              className="bg-gray-100"
            />
          </div>
          <div>
            <Label htmlFor="standing_water_level">Standing Water Level (m BGL)</Label>
            <Input
              {...register('standing_water_level')}
              disabled={!canEdit}
              className="bg-orange-50"
            />
          </div>
          <div>
            <Label htmlFor="termination_depth">Termination Depth (m BGL)</Label>
            <Input
              {...register('termination_depth')}
              disabled={!canEdit}
              className="bg-orange-50"
            />
          </div>
        </div>

        {/* Right Column - Test Counts */}
        <div className="space-y-4">
          {/* Coordinates: E and L side by side under a single label */}
          <div>
            <Label>Co-ordinates</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">E</span>
                <Input
                  {...register('coordinate_e')}
                  disabled={!canEdit}
                  className="bg-gray-100 pl-6"
                  placeholder="e.g., 123456.789"
                />
              </div>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">L</span>
                <Input
                  {...register('coordinate_l')}
                  disabled={!canEdit}
                  className="bg-gray-100 pl-6"
                  placeholder="e.g., 987654.321"
                />
              </div>
            </div>
          </div>
          <div>
            <Label>No. of Permeability test (PT)</Label>
            <Input
              {...register('permeability_tests_count')}
              disabled={!canEdit}
              className="bg-green-50"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>No. of SP test (S)</Label>
              <Input
                {...register('spt_tests_count')}
                disabled={!canEdit}
                className="bg-green-50"
              />
            </div>
            <div>
              <Label>VS test (VS)</Label>
              <Input
                {...register('vs_tests_count')}
                disabled={!canEdit}
                className="bg-green-50"
              />
            </div>
          </div>
          <div>
            <Label>No. of Undisturbed Sample (U)</Label>
            <Input
              {...register('undisturbed_samples_count')}
              disabled={!canEdit}
              className="bg-green-50"
            />
          </div>
          <div>
            <Label>No. of Disturbed Sample (D)</Label>
            <Input
              {...register('disturbed_samples_count')}
              disabled={!canEdit}
              className="bg-green-50"
            />
          </div>
          <div>
            <Label>No. of Water Sample (W)</Label>
            <Input
              {...register('water_samples_count')}
              disabled={!canEdit}
              className="bg-green-50"
            />
          </div>
        </div>
      </div>
    </div>
  );
}