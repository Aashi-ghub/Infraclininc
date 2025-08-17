import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BorelogFormData, Structure, Project, Borehole } from './types';

interface ProjectInfoSectionProps {
  form: UseFormReturn<BorelogFormData>;
  projects: Project[];
  structures: Structure[];
  boreholes: Borehole[];
  canEdit: boolean;
}

export function ProjectInfoSection({
  form,
  projects,
  structures,
  boreholes,
  canEdit
}: ProjectInfoSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Information</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Project, Structure, and Substructure Selection */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Project Selection</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Project Selection */}
            <FormField
              control={form.control}
              name="project_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Project</FormLabel>
                  <Select
                    disabled={!canEdit}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-yellow-100 border-yellow-300 focus:border-yellow-500">
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.project_id} value={project.project_id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Structure Selection */}
            <FormField
              control={form.control}
              name="structure_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Structure</FormLabel>
                  <Select
                    disabled={!canEdit || !form.watch('project_id')}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-yellow-100 border-yellow-300 focus:border-yellow-500">
                        <SelectValue placeholder="Select structure" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {structures.map((structure) => (
                        <SelectItem key={structure.structure_id} value={structure.structure_id}>
                          {structure.description || structure.type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Substructure Selection */}
            <FormField
              control={form.control}
              name="borehole_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Substructure</FormLabel>
                  <Select
                    disabled={!canEdit || !form.watch('structure_id')}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-yellow-100 border-yellow-300 focus:border-yellow-500">
                        <SelectValue placeholder="Select substructure" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {boreholes.map((borehole) => (
                        <SelectItem key={borehole.borehole_id} value={borehole.borehole_id}>
                          {borehole.borehole_number} - {borehole.location}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

                 <div className="w-full overflow-x-auto">
           <table className="w-full border-collapse border border-black text-xs project-info-table">
             <tbody>
               {/* Row 1: Job Code */}
               <tr>
                                   <td className="border border-black px-1 py-1 bg-gray-50 font-semibold text-xs text-black">Job Code</td>
                  <td className="border border-black px-1 py-1 linked-data">
                   <FormField
                     control={form.control}
                     name="job_code"
                     render={({ field }) => (
                       <FormItem className="m-0">
                         <FormControl>
                           <Input
                             disabled={!canEdit}
                             placeholder=""
                             className="border-0 p-1 text-xs h-6"
                             {...field}
                           />
                         </FormControl>
                         <FormMessage />
                       </FormItem>
                     )}
                   />
                 </td>
                                   <td className="border border-black px-1 py-1 bg-gray-50 font-semibold text-xs text-black">Section Name</td>
                  <td className="border border-black px-1 py-1 linked-data">
                   <FormField
                     control={form.control}
                     name="section_name"
                     render={({ field }) => (
                       <FormItem className="m-0">
                         <FormControl>
                           <Input
                             disabled={!canEdit}
                             placeholder="CNE-AGTL"
                             className="border-0 p-1 text-xs h-6"
                             {...field}
                           />
                         </FormControl>
                         <FormMessage />
                       </FormItem>
                     )}
                   />
                 </td>
                                   <td className="border border-black px-1 py-1 bg-gray-50 font-semibold text-xs text-black">Co-ordinate</td>
                  <td className="border border-black px-1 py-1 linked-data">
                   <div className="flex items-center">
                     <span className="text-xs font-semibold mr-1">E-</span>
                     <FormField
                       control={form.control}
                       name="coordinate_e"
                       render={({ field }) => (
                         <FormItem className="m-0 flex-1">
                           <FormControl>
                             <Input
                               disabled={!canEdit}
                               placeholder=""
                               className="border-0 p-1 text-xs h-6"
                               {...field}
                             />
                           </FormControl>
                           <FormMessage />
                         </FormItem>
                       )}
                     />
                   </div>
                 </td>
                  <td className="border border-black px-1 py-1 linked-data">
                   <div className="flex items-center">
                     <span className="text-xs font-semibold mr-1">L-</span>
                     <FormField
                       control={form.control}
                       name="coordinate_l"
                       render={({ field }) => (
                         <FormItem className="m-0 flex-1">
                           <FormControl>
                             <Input
                               disabled={!canEdit}
                               placeholder=""
                               className="border-0 p-1 text-xs h-6"
                               {...field}
                             />
                           </FormControl>
                           <FormMessage />
                         </FormItem>
                       )}
                     />
                   </div>
                 </td>
               </tr>

               {/* Row 2: Chainage */}
               <tr>
                                   <td className="border border-black px-1 py-1 bg-gray-50 font-semibold text-xs text-black">Chainage (Km)</td>
                  <td className="border border-black px-1 py-1 linked-data">
                   <FormField
                     control={form.control}
                     name="chainage_km"
                     render={({ field }) => (
                       <FormItem className="m-0">
                         <FormControl>
                           <Input
                             disabled={!canEdit}
                             placeholder=""
                             className="border-0 p-1 text-xs h-6"
                             {...field}
                             onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                             value={field.value || ''}
                           />
                         </FormControl>
                         <FormMessage />
                       </FormItem>
                     )}
                   />
                 </td>
                                   <td className="border border-black px-1 py-1 bg-gray-50 font-semibold text-xs text-black">Location</td>
                  <td className="border border-black px-1 py-1 linked-data">
                   <FormField
                     control={form.control}
                     name="location"
                     render={({ field }) => (
                       <FormItem className="m-0">
                         <FormControl>
                           <Input
                             disabled={!canEdit}
                             placeholder="BR-365 (STEEL GIDER)"
                             className="border-0 p-1 text-xs h-6"
                             {...field}
                           />
                         </FormControl>
                         <FormMessage />
                       </FormItem>
                     )}
                   />
                 </td>
                                   <td className="border border-black px-1 py-1 bg-gray-50 font-semibold text-xs text-black">No. of Permeabilty test (PT)</td>
                  <td colSpan={2} className="border border-black px-1 py-1 numeric-input">
                   <FormField
                     control={form.control}
                     name="permeability_tests_count"
                     render={({ field }) => (
                       <FormItem className="m-0">
                         <FormControl>
                           <Input
                             disabled={!canEdit}
                             type="number"
                             step="0.01"
                             min="0"
                             placeholder="0.00"
                             className="border-0 p-1 text-xs h-6 text-center"
                             {...field}
                             onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : 0)}
                             value={field.value || ''}
                           />
                         </FormControl>
                         <FormMessage />
                       </FormItem>
                     )}
                   />
                 </td>
               </tr>

               {/* Row 3: Borehole No. */}
               <tr>
                                   <td className="border border-black px-1 py-1 bg-gray-50 font-semibold text-xs text-black">Borehole No.</td>
                  <td className="border border-black px-1 py-1 linked-data">
                   <div className="p-1 text-xs h-6 flex items-center">
                     {form.watch('borehole_id') ? 
                       boreholes.find(b => b.borehole_id === form.watch('borehole_id'))?.borehole_number || '' 
                       : 'Select substructure above'
                     }
                   </div>
                 </td>
                                   <td className="border border-black px-1 py-1 bg-gray-50 font-semibold text-xs text-black">Commencement Date</td>
                  <td className="border border-black px-1 py-1 numeric-input">
                   <FormField
                     control={form.control}
                     name="commencement_date"
                     render={({ field }) => (
                       <FormItem className="m-0">
                         <FormControl>
                           <Input
                             disabled={!canEdit}
                             type="date"
                             className="border-0 p-1 text-xs h-6"
                             {...field}
                           />
                         </FormControl>
                         <FormMessage />
                       </FormItem>
                     )}
                   />
                 </td>
                                   <td className="border border-black px-1 py-1 bg-gray-50 font-semibold text-xs text-black">No. of SP test (S) & VS test (VS)</td>
                  <td className="border border-black px-1 py-1 calculated text-center text-xs">{form.watch('spt_tests_count') || 0}</td>
                  <td className="border border-black px-1 py-1 calculated text-center text-xs">{form.watch('vs_tests_count') || 0}</td>
               </tr>

               {/* Row 4: Mean Sea Level */}
               <tr>
                                   <td className="border border-black px-1 py-1 bg-gray-50 font-semibold text-xs text-black">Mean Sea Level (MSL)</td>
                  <td className="border border-black px-1 py-1 linked-data">
                   <FormField
                     control={form.control}
                     name="msl"
                     render={({ field }) => (
                       <FormItem className="m-0">
                         <FormControl>
                           <Input
                             disabled={!canEdit}
                             type="number"
                             step="0.01"
                             placeholder=""
                             className="border-0 p-1 text-xs h-6"
                             {...field}
                             onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                             value={field.value || ''}
                           />
                         </FormControl>
                         <FormMessage />
                       </FormItem>
                     )}
                   />
                 </td>
                                   <td className="border border-black px-1 py-1 bg-gray-50 font-semibold text-xs text-black">Completion Date</td>
                  <td className="border border-black px-1 py-1 numeric-input">
                   <FormField
                     control={form.control}
                     name="completion_date"
                     render={({ field }) => (
                       <FormItem className="m-0">
                         <FormControl>
                           <Input
                             disabled={!canEdit}
                             type="date"
                             className="border-0 p-1 text-xs h-6"
                             {...field}
                           />
                         </FormControl>
                         <FormMessage />
                       </FormItem>
                     )}
                   />
                 </td>
                                   <td className="border border-black px-1 py-1 bg-gray-50 font-semibold text-xs text-black">No. of Undisturbed Sample (U)</td>
                  <td colSpan={2} className="border border-black px-1 py-1 calculated text-center text-xs">5</td>
               </tr>

               {/* Row 5: Method of Boring */}
               <tr>
                                   <td className="border border-black px-1 py-1 bg-gray-50 font-semibold text-xs text-black">Method of Boring / Drilling</td>
                  <td className="border border-black px-1 py-1 manual-text">
                   <FormField
                     control={form.control}
                     name="method_of_boring"
                     render={({ field }) => (
                       <FormItem className="m-0">
                         <FormControl>
                           <Input
                             disabled={!canEdit}
                             placeholder="Rotary Drilling"
                             className="border-0 p-1 text-xs h-6"
                             {...field}
                           />
                         </FormControl>
                         <FormMessage />
                       </FormItem>
                     )}
                   />
                 </td>
                                   <td className="border border-black px-1 py-1 bg-gray-50 font-semibold text-xs text-black">Standing Water Level</td>
                  <td className="border border-black px-1 py-1 manual-text">
                   <FormField
                     control={form.control}
                     name="standing_water_level"
                     render={({ field }) => (
                       <FormItem className="m-0">
                         <FormControl>
                           <Input
                             disabled={!canEdit}
                             type="number"
                             step="0.01"
                             placeholder="0.70 m BGL"
                             className="border-0 p-1 text-xs h-6"
                             {...field}
                             onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                             value={field.value || ''}
                           />
                         </FormControl>
                         <FormMessage />
                       </FormItem>
                     )}
                   />
                 </td>
                                   <td className="border border-black px-1 py-1 bg-gray-50 font-semibold text-xs text-black">No. of Disturbed Sample (D)</td>
                  <td colSpan={2} className="border border-black px-1 py-1 calculated text-center text-xs">23 (D-1 &amp; S/D-22)</td>
               </tr>

               {/* Row 6: Diameter of Hole */}
               <tr>
                                   <td className="border border-black px-1 py-1 bg-gray-50 font-semibold text-xs text-black">Diameter of Hole</td>
                  <td className="border border-black px-1 py-1 manual-text">
                   <FormField
                     control={form.control}
                     name="diameter_of_hole"
                     render={({ field }) => (
                       <FormItem className="m-0">
                         <FormControl>
                           <Input
                             disabled={!canEdit}
                             placeholder="150 mm"
                             className="border-0 p-1 text-xs h-6"
                             {...field}
                           />
                         </FormControl>
                         <FormMessage />
                       </FormItem>
                     )}
                   />
                 </td>
                                   <td className="border border-black px-1 py-1 bg-gray-50 font-semibold text-xs text-black">Termination Depth</td>
                  <td className="border border-black px-1 py-1 calculated">
                   <div className="p-1 text-xs h-6 flex items-center">
                     {(() => {
                       const stratumRows = form.watch('stratum_rows') || [];
                       if (stratumRows.length === 0) {
                         return '0.00 m BGL';
                       }
                       // Find the maximum depth_to value from all stratum rows
                       const maxDepth = Math.max(...stratumRows
                         .map(row => row.depth_to || 0)
                         .filter(depth => depth > 0)
                       );
                       return maxDepth > 0 ? `${maxDepth.toFixed(2)} m BGL` : '0.00 m BGL';
                     })()}
                   </div>
                 </td>
                                   <td className="border border-black px-1 py-1 bg-gray-50 font-semibold text-xs text-black">No. of Water Sample (W)</td>
                  <td colSpan={2} className="border border-black px-1 py-1 numeric-input">
                   <FormField
                     control={form.control}
                     name="water_samples_count"
                     render={({ field }) => (
                       <FormItem className="m-0">
                         <FormControl>
                           <Input
                             disabled={!canEdit}
                             type="number"
                             step="0.01"
                             min="0"
                             placeholder="0.00"
                             className="border-0 p-1 text-xs h-6 text-center"
                             {...field}
                             onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : 0)}
                             value={field.value || ''}
                           />
                         </FormControl>
                         <FormMessage />
                       </FormItem>
                     )}
                   />
                 </td>
               </tr>
             </tbody>
           </table>
         </div>
      </CardContent>
    </Card>
  );
}
