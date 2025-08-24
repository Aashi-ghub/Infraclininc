/**
 * Test UUID validation logic
 */

// Frontend UUID validation function (same as updated in components)
const isValidUUID = (uuid) => {
  // Check for complete UUID format (5 parts)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(uuid)) {
    return true;
  }
  
  // Check for assignment_id-index format (6+ parts)
  const parts = uuid.split('-');
  if (parts.length >= 6) {
    // Check if the first 5 parts form a valid UUID
    const assignmentId = parts.slice(0, -1).join('-');
    return uuidRegex.test(assignmentId);
  }
  
  return false;
};

// Test cases
const testCases = [
  // Valid complete UUIDs
  'f8bf2120-9a88-456d-a462-0f7535a949b5',
  'a13bb900-7d9e-457c-ac3c-99154e5a4c50',
  
  // Valid assignment_id-index format
  'a13bb900-7d9e-457c-ac3c-99154e5a4c50-0',
  'f8bf2120-9a88-456d-a462-0f7535a949b5-1',
  '7424ba93-9229-4f56-93aa-053840df0be6-0',
  
  // Invalid UUIDs
  'invalid-uuid',
  'f8bf2120-9a88-456d-a462', // incomplete
  'not-a-uuid-at-all',
  'a13bb900-7d9e-457c-ac3c-99154e5a4c50-invalid', // invalid suffix
];

console.log('🧪 Testing UUID Validation Logic');
console.log('================================\n');

testCases.forEach((testCase, index) => {
  const isValid = isValidUUID(testCase);
  const status = isValid ? '✅ VALID' : '❌ INVALID';
  console.log(`${index + 1}. ${status}: ${testCase}`);
});

console.log('\n📋 Summary:');
console.log('- Complete UUIDs (5 parts): Should be valid');
console.log('- Assignment ID + Index (6+ parts): Should be valid if assignment ID is valid');
console.log('- Invalid formats: Should be invalid');
