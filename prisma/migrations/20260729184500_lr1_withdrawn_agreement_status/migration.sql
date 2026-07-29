-- LR-1 (James-ruled): customers can withdraw a pending arrangement request.
-- WITHDRAWN is the customer-side terminal twin of DECLINED/EXPIRED — no money
-- ever moved in any of them, by construction.
ALTER TYPE "AgreementStatus" ADD VALUE 'WITHDRAWN';
