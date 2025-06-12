# Claude Instructions: Instruction Forms Implementation

## Your Mission
Implement the instruction forms addendum to support multiple forms per instruction mnemonic.

## Tasks Checklist
- [ ] 1. Read the `spec/instruction_forms_addendum.md` to understand multiple instruction forms
- [ ] 2. Update the main specification to support multiple forms per instruction mnemonic
- [ ] 3. Create examples showing instruction variants (e.g., add with/without immediate)
- [ ] 4. Update the mask specification to handle form disambiguation
- [ ] 5. Add validation rules for instruction form conflicts and overlaps
- [ ] 6. Document how disassemblers should handle multiple forms
- [ ] 7. Create test cases for complex instruction form scenarios
- [ ] 8. Run any available tests and ensure form resolution works correctly
- [ ] 9. Commit your changes with descriptive messages
- [ ] 10. Push to the remote branch
- [ ] 11. Create a pull request to master with summary of changes

## Focus
Enabling multiple instruction forms with the same mnemonic but different operand patterns.

## Branch
You are working on: `feature/instruction-forms-addendum`

## Key Files to Update
- Main specification file (`spec/isa_language_specification.md`)
- Instruction definition sections
- Example files demonstrating multiple forms
- Mask specification and validation rules

## Start Here
Begin by reading the addendum file and then planning how to modify the instruction definition syntax to support multiple forms.