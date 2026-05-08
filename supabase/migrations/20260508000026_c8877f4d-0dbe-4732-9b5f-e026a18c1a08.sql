
UPDATE public.profiles SET role = 'admin', active = true WHERE email = 'jhb@jhb.is';
DELETE FROM public.profiles WHERE email = 'magnus@modulus.is';
DELETE FROM auth.users WHERE email = 'magnus@modulus.is';
