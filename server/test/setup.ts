/**
 * Test setup for ISA Language Server
 */

// Global test setup
beforeAll(() => {
  // Set test environment
  process.env.NODE_ENV = 'test';
});

afterAll(() => {
  // Cleanup
});

// Add custom matchers if needed
expect.extend({
  toHaveValidationError(received: any[], expectedCode: string) {
    const hasError = received.some(error => error.code === expectedCode);
    if (hasError) {
      return {
        message: () => `Expected not to have validation error with code ${expectedCode}`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected to have validation error with code ${expectedCode}`,
        pass: false,
      };
    }
  },
});