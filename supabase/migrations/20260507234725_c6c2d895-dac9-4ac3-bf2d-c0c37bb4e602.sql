
INSERT INTO public.sales_targets (owner_id, period_type, period_start, period_end, target_isk) VALUES
-- Unnur
('a47fef94-ad8c-4f50-9e5f-a646fbec58fc','quarter','2026-01-01','2026-03-31',18791354),
('a47fef94-ad8c-4f50-9e5f-a646fbec58fc','quarter','2026-04-01','2026-06-30',44847081),
('a47fef94-ad8c-4f50-9e5f-a646fbec58fc','quarter','2026-07-01','2026-09-30',45795278),
('a47fef94-ad8c-4f50-9e5f-a646fbec58fc','quarter','2026-10-01','2026-12-31',47845453),
('a47fef94-ad8c-4f50-9e5f-a646fbec58fc','year','2026-01-01','2026-12-31',157279166),
-- Magnús (Q1 2025 negative -> use oldest Q3 2023)
('b3da630c-ed05-4fc7-ac7d-5274d5d641d5','quarter','2026-01-01','2026-03-31',3443990),
('b3da630c-ed05-4fc7-ac7d-5274d5d641d5','quarter','2026-04-01','2026-06-30',12040919),
('b3da630c-ed05-4fc7-ac7d-5274d5d641d5','quarter','2026-07-01','2026-09-30',23600165),
('b3da630c-ed05-4fc7-ac7d-5274d5d641d5','quarter','2026-10-01','2026-12-31',4894359),
('b3da630c-ed05-4fc7-ac7d-5274d5d641d5','year','2026-01-01','2026-12-31',43979433),
-- Una
('b8a3d6f4-37dd-447b-8f56-21cc7280a42d','quarter','2026-01-01','2026-03-31',123750),
('b8a3d6f4-37dd-447b-8f56-21cc7280a42d','quarter','2026-04-01','2026-06-30',1808070),
('b8a3d6f4-37dd-447b-8f56-21cc7280a42d','quarter','2026-07-01','2026-09-30',3624826),
('b8a3d6f4-37dd-447b-8f56-21cc7280a42d','quarter','2026-10-01','2026-12-31',13608760),
('b8a3d6f4-37dd-447b-8f56-21cc7280a42d','year','2026-01-01','2026-12-31',19165406),
-- Ólöf
('b9746332-97b2-4b31-96e8-85b6a62e97e7','quarter','2026-01-01','2026-03-31',1198681),
('b9746332-97b2-4b31-96e8-85b6a62e97e7','quarter','2026-04-01','2026-06-30',2755940),
('b9746332-97b2-4b31-96e8-85b6a62e97e7','quarter','2026-07-01','2026-09-30',4352194),
('b9746332-97b2-4b31-96e8-85b6a62e97e7','quarter','2026-10-01','2026-12-31',6162628),
('b9746332-97b2-4b31-96e8-85b6a62e97e7','year','2026-01-01','2026-12-31',14469443),
-- Jakob (Q1 2025 negative -> use oldest Q2 2024)
('d70e72eb-9bfb-4e2e-b858-87b0b9dbeda0','quarter','2026-01-01','2026-03-31',362736),
('d70e72eb-9bfb-4e2e-b858-87b0b9dbeda0','quarter','2026-04-01','2026-06-30',2695851),
('d70e72eb-9bfb-4e2e-b858-87b0b9dbeda0','quarter','2026-07-01','2026-09-30',58949),
('d70e72eb-9bfb-4e2e-b858-87b0b9dbeda0','quarter','2026-10-01','2026-12-31',1100946),
('d70e72eb-9bfb-4e2e-b858-87b0b9dbeda0','year','2026-01-01','2026-12-31',4218482)
ON CONFLICT (owner_id, period_type, period_start) DO UPDATE SET target_isk = EXCLUDED.target_isk, updated_at = now();
