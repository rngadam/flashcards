import { expect } from 'chai';
import jsdomGlobal from 'jsdom-global';
import sinon from 'sinon';

// bring up a minimal DOM from index.html
import fs from 'fs';
import path from 'path';

describe('Multiple Choice integration (DOM)', function () {
  let cleanup;
  before(function () {
    cleanup = jsdomGlobal();
    const html = fs.readFileSync(path.resolve('./index.html'), 'utf8');
    document.body.innerHTML = html;
    // load app module after DOM is ready
  });

  after(function () {
    if (cleanup) cleanup();
  });

  it('should generate multiple choice options and handle a click', async function () {
    // Import the parts we need
    const verification = await import('../lib/core/verification.js');
    const dom = await import('../lib/ui/dom-elements.js');
    const stateMod = await import('../lib/core/state.js');

    // Prepare minimal state
    const { updateState } = stateMod;
    updateState({
      configs: { default: { multipleChoiceCount: 3, roleToColumnMap: { TARGET_LANGUAGE: [1] } } },
      cardData: [['front', 'correct', 'other'], ['a', 'b', 'c']],
      currentCardIndex: 0
    });

    // make sure DOM config selector points to our 'default' config
    const configSelector = document.getElementById('config-selector');
    if (configSelector) {
      const opt = document.createElement('option');
      opt.value = 'default';
      opt.text = 'default';
      configSelector.appendChild(opt);
      configSelector.value = 'default';
    }

    // Mock getCurrentSkillConfig to return validation column role pointing to index 1
    const skillModule = await import('../lib/core/skill-manager.js');
    // Instead of full skill manager wiring, stub getCurrentSkillConfig used by verification
    const verificationModule = await import('../lib/core/verification.js');

    // Create a fake getCurrentSkillConfig that returns a validationColumn role
    const fakeGetCurrentSkillConfig = () => ({ verificationMethod: 'multiple_choice', validationColumn: 'TARGET_LANGUAGE' });

    // Monkeypatch the function used by verification module
    verificationModule.initVerification({
      dom: dom.default,
      state: stateMod.getState(),
      updateState: updateState,
      showTopNotification: () => {},
      markCardAsKnown: async () => {},
      flipCard: async () => {},
      showNextCard: async () => {},
      getCurrentSkillConfig: fakeGetCurrentSkillConfig,
      getLanguageForRole: () => 'en'
    });

    // Ensure the multiple choice container exists in DOM (from index.html)
    const mcContainer = document.getElementById('multiple-choice-container');
    expect(mcContainer).to.exist;

    // Now call generateMultipleChoiceOptions
    verificationModule.generateMultipleChoiceOptions();

    // Expect some buttons
    const buttons = mcContainer.querySelectorAll('button');
    expect(buttons.length).to.be.at.least(1);

  // Simulate clicking the first button
  const first = buttons[0];
  first.click();

  // Wait a tick for the async handler to complete
  await new Promise(resolve => setTimeout(resolve, 0));

  // After click, container should have class 'answered'
  expect(mcContainer.classList.contains('answered')).to.be.true;

  // Buttons should have correct/incorrect classes set
  const correctExists = Array.from(buttons).some(b => b.classList.contains('correct'));
  expect(correctExists).to.be.true;
  });
});
