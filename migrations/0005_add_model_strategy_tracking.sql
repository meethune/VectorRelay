-- Add model_strategy column to summaries table for tracking which AI approach was used
-- This enables quality comparison between baseline (Llama 70B) and trimodel (Mistral 24B + Qwen 30B)

-- Add the new column (will be NULL for existing records)
ALTER TABLE summaries ADD COLUMN model_strategy TEXT;

-- Backfill existing records as 'baseline' since they were all generated with baseline mode
-- (Before this migration, all articles were processed with Llama 70B baseline)
UPDATE summaries SET model_strategy = 'baseline' WHERE model_strategy IS NULL;
