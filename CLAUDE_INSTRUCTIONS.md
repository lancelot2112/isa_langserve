# Claude Instructions: Alias to Redirect Implementation

## Your Mission
Implement the alias to redirect syntax change to improve clarity in field definitions.

## Tasks Checklist
- [ ] 1. Read the `spec/alias_to_redirect_addendum.md` to understand the changes
- [ ] 2. Update the main specification to replace alias= with redirect= syntax
- [ ] 3. Update all example files that use alias= to use redirect= instead
- [ ] 4. Ensure the semantic meaning remains the same but syntax is updated
- [ ] 5. Update any validation rules that check for alias syntax
- [ ] 6. Run any available tests to ensure compatibility
- [ ] 7. Commit your changes with descriptive messages
- [ ] 8. Push to the remote branch
- [ ] 9. Create a pull request to master with summary of changes

## Focus
Global find/replace of `alias=` with `redirect=` while maintaining semantic equivalence.

## Branch
You are working on: `feature/alias-redirect-addendum`

## Key Files to Update
- Main specification file (`spec/isa_language_specification.md`)
- All `.isa` files in `examples/` directory that use alias=
- Any validation or documentation referencing alias syntax

## Start Here
Begin by reading the addendum file and then searching for all occurrences of `alias=` across the codebase.
