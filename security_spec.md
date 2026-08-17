# Security Specification & Threat Model for Madeireira Sol Nascente

## Data Invariants
1. **Cargas de Madeira**: Every Carga entry must have a valid non-empty `date`, `product`, positive `quantityTons`, positive `valuePerTon`, `totalValue`, and boolean `deductFromBalance`.
2. **Depósitos Klabin**: Every Depósito must contain a valid positive `value` and ISO `date`.
3. **Clientes**: Must have a non-empty `name`.
4. **Vendas**: Must have a valid `date`, `clientName`, `product`, positive `quantity`, positive `unitPrice`, and valid `status` ('PENDING', 'PAID', 'CANCELLED').
5. **Produtos**: Must have a non-empty `name`, non-negative `referencePrice`, valid `unitOfMeasure`, and status ('ACTIVE', 'INACTIVE').
6. **Motoristas**: Must have a valid `name`, `licensePlate`, and status ('ACTIVE', 'INACTIVE').

## Dirty Dozen Payloads (Security Testing Vector Matrix)
1. Shadow update injecting arbitrary fields (`isSystemAdmin: true`).
2. ID poisoning with junk strings (>128 chars).
3. Negative or NaN currency/quantity values in Cargas or Vendas.
4. Over-sized string payloads (>10KB notes/fields) to exhaust database storage quota.
5. Unauthorized document creation with malformed status or missing required schema properties.
6. Identity spoofing or unauthenticated write access.
7. Spoofed email address without `email_verified == true`.
8. Updating immutable fields like `createdAt`.
9. Out-of-bounds array or recursive map injections.
10. Malformed date formats or invalid enum status bypasses.
11. PII data leakage to unauthenticated client requests.
12. Attempting to override system settings with malformed parameters.

## Access Control & Rules Policy
- All collections (`cargas`, `depositos`, `clientes`, `vendas`, `produtos`, `motoristas`, `settings`) permit read/write operations for authenticated or authorized system users with data validation enforcement.
