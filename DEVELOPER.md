# Developer Guide

This document provides instructions for developers to validate their code changes before submitting. Following these steps is mandatory to ensure code quality and prevent regressions.

## Pre-Submission Validation Workflow

Before submitting any code, you **must** perform the following steps in order.

### 1. Install Dependencies

Ensure you have all the necessary project dependencies installed. If you have just cloned the repository or if dependencies have been updated, run:

```bash
npm install
```

### 2. Run the Linter

The project uses ESLint to enforce code style and catch common errors. The linter must pass without any errors.

To run the linter across all relevant files, execute:

```bash
npm run lint
```

If the linter reports any errors, you must fix them before proceeding.

### 3. Run Tests

The project has a test suite to verify core functionality. All tests must pass to ensure that your changes have not introduced any regressions.

To run the test suite, execute:

```bash
npm test
```

If any tests fail, you must fix them before proceeding.

---

**Only after all three steps have been completed successfully should you submit your changes.**
