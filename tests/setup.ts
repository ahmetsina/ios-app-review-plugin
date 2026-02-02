// Jest setup file
// Add any global test configuration here

// Increase timeout for integration tests
jest.setTimeout(30000);

// Suppress console output during tests unless explicitly needed
if (process.env['SUPPRESS_CONSOLE'] !== 'false') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  };
}
