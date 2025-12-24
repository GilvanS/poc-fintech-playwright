// Generated from: tests\features\login.feature
import { test } from "../../../tests/fixtures.ts";

test.describe('Login na Fintech', () => {

  test.beforeEach('Background', async ({ Given, landingPage }, testInfo) => { if (testInfo.error) return;
    await Given('que acesso a página inicial', null, { landingPage }); 
  });
  
  test('Login com sucesso como Admin', async ({ When, Then, And, landingPage, page }) => { 
    await When('inicio o login', null, { landingPage }); 
    await And('preencho o CPF "11111111111" e senha "admin999"', null, { landingPage }); 
    await Then('devo ver a área logada', null, { page }); 
  });

  test('Login com sucesso como Cliente', async ({ When, Then, And, landingPage, page }) => { 
    await When('inicio o login', null, { landingPage }); 
    await And('preencho o CPF "999.999.999-99" e senha "admin999"', null, { landingPage }); 
    await Then('devo ver a área logada', null, { page }); 
  });

  test.describe('Validar campos obrigatórios', () => {

    test('Example #1', async ({ When, Then, And, landingPage, page }) => { 
      await When('inicio o login', null, { landingPage }); 
      await And('preencho o CPF "" e senha ""', null, { landingPage }); 
      await Then('devo ver a mensagem de alerta "Campo obrigatório"', null, { landingPage, page }); 
    });

    test('Example #2', async ({ When, Then, And, landingPage, page }) => { 
      await When('inicio o login', null, { landingPage }); 
      await And('preencho o CPF "999.999.999-99" e senha ""', null, { landingPage }); 
      await Then('devo ver a mensagem de alerta "Campo obrigatório"', null, { landingPage, page }); 
    });

    test('Example #3', async ({ When, Then, And, landingPage, page }) => { 
      await When('inicio o login', null, { landingPage }); 
      await And('preencho o CPF "" e senha "admin999"', null, { landingPage }); 
      await Then('devo ver a mensagem de alerta "Campo obrigatório"', null, { landingPage, page }); 
    });

  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('tests\\features\\login.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":10,"pickleLine":10,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":8,"keywordType":"Context","textWithKeyword":"Given que acesso a página inicial","isBg":true,"stepMatchArguments":[]},{"pwStepLine":11,"gherkinStepLine":11,"keywordType":"Action","textWithKeyword":"When inicio o login","stepMatchArguments":[]},{"pwStepLine":12,"gherkinStepLine":12,"keywordType":"Action","textWithKeyword":"And preencho o CPF \"11111111111\" e senha \"admin999\"","stepMatchArguments":[{"group":{"start":15,"value":"\"11111111111\"","children":[{"start":16,"value":"11111111111","children":[{"children":[]}]},{"children":[{"children":[]}]}]},"parameterTypeName":"string"},{"group":{"start":37,"value":"\"admin999\"","children":[{"start":38,"value":"admin999","children":[{"children":[]}]},{"children":[{"children":[]}]}]},"parameterTypeName":"string"}]},{"pwStepLine":13,"gherkinStepLine":13,"keywordType":"Outcome","textWithKeyword":"Then devo ver a área logada","stepMatchArguments":[]}]},
  {"pwTestLine":16,"pickleLine":15,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":8,"keywordType":"Context","textWithKeyword":"Given que acesso a página inicial","isBg":true,"stepMatchArguments":[]},{"pwStepLine":17,"gherkinStepLine":16,"keywordType":"Action","textWithKeyword":"When inicio o login","stepMatchArguments":[]},{"pwStepLine":18,"gherkinStepLine":17,"keywordType":"Action","textWithKeyword":"And preencho o CPF \"999.999.999-99\" e senha \"admin999\"","stepMatchArguments":[{"group":{"start":15,"value":"\"999.999.999-99\"","children":[{"start":16,"value":"999.999.999-99","children":[{"children":[]}]},{"children":[{"children":[]}]}]},"parameterTypeName":"string"},{"group":{"start":40,"value":"\"admin999\"","children":[{"start":41,"value":"admin999","children":[{"children":[]}]},{"children":[{"children":[]}]}]},"parameterTypeName":"string"}]},{"pwStepLine":19,"gherkinStepLine":18,"keywordType":"Outcome","textWithKeyword":"Then devo ver a área logada","stepMatchArguments":[]}]},
  {"pwTestLine":24,"pickleLine":27,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":8,"keywordType":"Context","textWithKeyword":"Given que acesso a página inicial","isBg":true,"stepMatchArguments":[]},{"pwStepLine":25,"gherkinStepLine":21,"keywordType":"Action","textWithKeyword":"When inicio o login","stepMatchArguments":[]},{"pwStepLine":26,"gherkinStepLine":22,"keywordType":"Action","textWithKeyword":"And preencho o CPF \"\" e senha \"\"","stepMatchArguments":[{"group":{"start":15,"value":"\"\"","children":[{"start":16,"value":"","children":[{"children":[]}]},{"children":[{"children":[]}]}]},"parameterTypeName":"string"},{"group":{"start":26,"value":"\"\"","children":[{"start":27,"value":"","children":[{"children":[]}]},{"children":[{"children":[]}]}]},"parameterTypeName":"string"}]},{"pwStepLine":27,"gherkinStepLine":23,"keywordType":"Outcome","textWithKeyword":"Then devo ver a mensagem de alerta \"Campo obrigatório\"","stepMatchArguments":[{"group":{"start":30,"value":"\"Campo obrigatório\"","children":[{"start":31,"value":"Campo obrigatório","children":[{"children":[]}]},{"children":[{"children":[]}]}]},"parameterTypeName":"string"}]}]},
  {"pwTestLine":30,"pickleLine":28,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":8,"keywordType":"Context","textWithKeyword":"Given que acesso a página inicial","isBg":true,"stepMatchArguments":[]},{"pwStepLine":31,"gherkinStepLine":21,"keywordType":"Action","textWithKeyword":"When inicio o login","stepMatchArguments":[]},{"pwStepLine":32,"gherkinStepLine":22,"keywordType":"Action","textWithKeyword":"And preencho o CPF \"999.999.999-99\" e senha \"\"","stepMatchArguments":[{"group":{"start":15,"value":"\"999.999.999-99\"","children":[{"start":16,"value":"999.999.999-99","children":[{"children":[]}]},{"children":[{"children":[]}]}]},"parameterTypeName":"string"},{"group":{"start":40,"value":"\"\"","children":[{"start":41,"value":"","children":[{"children":[]}]},{"children":[{"children":[]}]}]},"parameterTypeName":"string"}]},{"pwStepLine":33,"gherkinStepLine":23,"keywordType":"Outcome","textWithKeyword":"Then devo ver a mensagem de alerta \"Campo obrigatório\"","stepMatchArguments":[{"group":{"start":30,"value":"\"Campo obrigatório\"","children":[{"start":31,"value":"Campo obrigatório","children":[{"children":[]}]},{"children":[{"children":[]}]}]},"parameterTypeName":"string"}]}]},
  {"pwTestLine":36,"pickleLine":29,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":8,"keywordType":"Context","textWithKeyword":"Given que acesso a página inicial","isBg":true,"stepMatchArguments":[]},{"pwStepLine":37,"gherkinStepLine":21,"keywordType":"Action","textWithKeyword":"When inicio o login","stepMatchArguments":[]},{"pwStepLine":38,"gherkinStepLine":22,"keywordType":"Action","textWithKeyword":"And preencho o CPF \"\" e senha \"admin999\"","stepMatchArguments":[{"group":{"start":15,"value":"\"\"","children":[{"start":16,"value":"","children":[{"children":[]}]},{"children":[{"children":[]}]}]},"parameterTypeName":"string"},{"group":{"start":26,"value":"\"admin999\"","children":[{"start":27,"value":"admin999","children":[{"children":[]}]},{"children":[{"children":[]}]}]},"parameterTypeName":"string"}]},{"pwStepLine":39,"gherkinStepLine":23,"keywordType":"Outcome","textWithKeyword":"Then devo ver a mensagem de alerta \"Campo obrigatório\"","stepMatchArguments":[{"group":{"start":30,"value":"\"Campo obrigatório\"","children":[{"start":31,"value":"Campo obrigatório","children":[{"children":[]}]},{"children":[{"children":[]}]}]},"parameterTypeName":"string"}]}]},
]; // bdd-data-end