-- §38 point 5 : X Detailing encaisse l'ensemble des prestations et reverse à la
-- quinzaine. Les espèces perçues sur le terrain lui appartiennent donc dès
-- l'encaissement ; l'opérateur les détient simplement, et elles sont déduites de son
-- virement.
--
-- Reprise des encaissements antérieurs à cette décision : ils étaient enregistrés au
-- bénéfice de l'opérateur. `collectedByOperatorId` continue d'indiquer qui détient
-- physiquement les fonds — c'est cette colonne, et non `beneficiary`, qui sert au calcul
-- du reversement.
UPDATE "Payment"
SET "beneficiary" = 'XDETAILING'
WHERE "beneficiary" = 'OPERATOR';
