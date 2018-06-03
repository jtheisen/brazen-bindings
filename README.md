

# Rationale

* type safety
* binding definitions
    * two-way
    * inline
* small building blocks because one size
  fits it all isn't realistic

# Update and validation trigger times

Invalid input should be
* marked as such while focused and reset on blur,
* marked as such while focused and kept on blur,
* marked as such on blur,
* marked as such on blur, but unmarked on focus.

Valid input should update the source
* while focused or
* on blur.

Invalid sources should
* validate also or
* not.

# Other critical

* validation context
* external validation trigger (for validating on save)

# Other

* conversions with validation
* throttling
* async validation
* source change while editing warning

# Testing

Test
* binding recreation
