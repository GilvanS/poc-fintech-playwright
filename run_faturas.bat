@echo off
echo ==============================================
echo Executando Testes de Fatura Um a Um (@CT03.X)
echo ==============================================

echo.
echo [1/5] Executando CT03.1 (Pagamento Total)
call npm run test:bdd:headed -- --grep "@CT03.1"

echo.
echo [2/5] Executando CT03.2 (Pagamento Mínimo)
call npm run test:bdd:headed -- --grep "@CT03.2"

echo.
echo [3/5] Executando CT03.3 (Pagamento Parcial)
call npm run test:bdd:headed -- --grep "@CT03.3"

echo.
echo [4/5] Executando CT03.4 (Pagamento Menor que Mínimo)
call npm run test:bdd:headed -- --grep "@CT03.4"

echo.
echo [5/5] Executando CT03.5 (Pagamento Maior que Mínimo)
call npm run test:bdd:headed -- --grep "@CT03.5"

echo.
echo Execucao finalizada!
