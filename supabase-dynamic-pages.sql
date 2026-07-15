-- Dynamic About/Repository page editor for HCNYAstro.
-- Run this in Supabase SQL Editor once.

create table if not exists public.content_pages (
    slug text primary key check (slug in ('about', 'repository')),
    title text not null,
    body text not null,
    updated_by uuid references auth.users(id) on delete set null,
    updated_at timestamptz not null default now()
);

alter table public.content_pages enable row level security;

drop policy if exists "content pages are public" on public.content_pages;
create policy "content pages are public"
on public.content_pages
for select
using (true);

drop policy if exists "admin can insert content pages" on public.content_pages;
create policy "admin can insert content pages"
on public.content_pages
for insert
with check (
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'hcnyastro@gmail.com'
    or exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
);

drop policy if exists "admin can update content pages" on public.content_pages;
create policy "admin can update content pages"
on public.content_pages
for update
using (
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'hcnyastro@gmail.com'
    or exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
)
with check (
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'hcnyastro@gmail.com'
    or exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
);

insert into public.content_pages (slug, title, body)
values
(
    'about',
    'About',
    'HCNYAstro is an astronomy interest group from Hwa Chong Institution (High School) and Nanyang Girls'' High School.

We collect resources for students to learn more about astronomy, organise events such as stargazing to give students a chance at practical experiences, and other lessons.

The interest group has a long history going far back, even before the 2020s. Originally, it started as a small, informal interest group that emerged from the pure love of astronomy, with a few people hosting sessions where HCIHS students would go over to the JC Astro club and sit in on their lessons.

HCNYAstro was founded in its current form in 2021 when the HS Astronomy interest group expanded to encompass NYGH as well, under the guidance of our senior Tey Yi Fan (graduated 2022). From there, it grew into its own independent interest group, organising its own online lessons, practical sessions, and even collaborating with other schools.

We hope that in the years to come, the interest group will continue to spark a love for astronomy in many more generations of young astronomers, from HCI, NYGH, and the rest of Singapore.

*Our current EXCO line-up*

- Wang Xingshuo, HCI
- Ng Chyng Yi, NYGH
- Nay Myo Win, HCI
- Teh Jiaying, NYGH
- Loke Kei Nga Tricia, NYGH
- Zhao Wenying, NYGH
- Liu Haochen, HCI'
),
(
    'repository',
    'Repository',
    '*Resources*

[AOGuide][https://www.aoguide.app/] contains the core astronomy olympiad content you will need. It is strongest as a reference, so use the handouts and practice materials alongside it for olympiad technique.

*Handouts*

To be added soon

[Handout explanation videos][https://www.aoguide.app/] are December 2026 training resources prepared for HCNY Astronomy contributors.

*Lesson slides and materials*

Open the [lesson slides and materials][https://drive.google.com/drive/folders/11fzTbXRS3pTrSB5io9DIzJJqmk0Y2_7j?usp=drive_link] folder for class slides, worksheets, and extra lesson materials.

- [HCNYAstro Session 1][https://docs.google.com/presentation/d/1e_t3ULCi6ijZcE73-1k4_UN_SuuyT6LzJFOwCDd2g6w/edit?usp=drive_web]
- [HCNYAstro Session 2][https://docs.google.com/presentation/d/1EQnfo_FA1UNS9HjMl3rysR4F2O2CLL7aeagkw5tSFJk/edit?usp=drive_web]
- [COM Session 1: Centre of Mass][https://docs.google.com/presentation/d/1-H0OFl6gO9_XGZTgzlqLa2xzynD_i77Za2AZCmOXi8A/edit?usp=drive_web]
- [HCNY Session 4][https://docs.google.com/presentation/d/1a6HJCLElkrimyBBRKaw137ZyUyIcqiqjYCs63K6pugY/edit?usp=drive_web]
- [HCNY Session 4 Final Version][https://docs.google.com/presentation/d/1quKnZl74dr9tznAyepwtp6qVe0Wy4-aqSFX4Tebm7vU/edit?usp=drive_web]
- [Prerequisite Mechanics for HCNY Astro][https://docs.google.com/presentation/d/1xRxJJrZyTPVHY0u0ooZTqfCkak07_Gh5x09r2G0KVdc/edit?usp=drive_web]
- [Prerequisite Mechanics (Simplified)][https://docs.google.com/presentation/d/1LuJcgeLFQJcY9OkRdGHtIA0fzLMhQrjopXqw_j6xmOY/edit?usp=drive_web]
- [Celestial Mechanics (All)][https://docs.google.com/presentation/d/1TAZdBWjSx2xzm0sYXhiR6xviq3uIiOBW1lq_L1ZDJ58/edit?usp=drive_web]
- [Relativity][https://docs.google.com/presentation/d/1MHSKJTDXFXbXp9K7FLfAExN6C33r7FoM3p_XNV2SFFU/edit?usp=drive_web]'
)
on conflict (slug) do nothing;
