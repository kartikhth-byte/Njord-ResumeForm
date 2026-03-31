with course_mapping(course_name, imo_model_course, reference_regulation) as (
  values
    ('Basic Training', '1.19 - 1.20 - 1.13 - 1.21', 'STCW Reg. A-VI/1-1 to A-VI/1-4'),
    ('Personal Survival Techniques - BASIC TRAINING', '1.19', 'STCW Reg. A-VI/1-1'),
    ('Basic Fire Fighting - BASIC TRAINING', '1.20', 'STCW Reg. A-VI/1-2'),
    ('Elementary First Aid - BASIC TRAINING', '1.13', 'STCW Reg. A-VI/1-3'),
    ('Personal Safety & Social Responsibilities (Human Relationship) - BASIC TRAINING', '1.21', 'STCW Reg. A-VI/1-4'),
    ('Proficiency in survival craft & Rescue Boats', '1.23', 'STCW Reg. A-VI/2 par 1.3'),
    ('Advanced Fire Fighting', '2.03', 'STCW Reg. A-VI/3'),
    ('Medical First Aid', '1.14', 'STCW Reg. A-VI/4-1'),
    ('Medical Care', '1.15', 'STCW Reg. A-VI/4-2 par 2'),
    ('ROP', '1.08', 'STCW Reg II/2'),
    ('ARPA / NCC', '1.07', 'STCW Reg II/1'),
    ('Radar Simulator', '', ''),
    ('ECDIS', '1.27', 'STCW Reg II/1 par 2.5'),
    ('HAZ MAT', '', 'US 49 CFR 172.700-172.204'),
    ('Ship simulator bridge teamwork', '1.22', 'STCW Reg II/1'),
    ('BTM / ETM', '', ''),
    ('Ship Security Officer (SSO)', '', 'STCW Reg VI/5 / ISPS Code'),
    ('BASSnet', '', ''),
    ('Ship handling & manoeuvring', '', 'STCW Reg II/1 & II/2'),
    ('Bridge resource management', '', 'STCW Reg VIII/2 US33CFR 157.415'),
    ('Loading software', '', ''),
    ('Large Vessel Handling Simulator / Engine Room Simulator', '', 'CMA CGM'),
    ('Indos Number', '', ''),
    ('Upgradation Course', '', ''),
    ('Revalidation Course for renewal of CoC', '', ''),
    ('High Voltage Training', '', ''),
    ('Reefer Training', '', ''),
    ('Engine Maker’s Training', '', ''),
    ('Crane Manufactures training', '', ''),
    ('Vessel security training course', '', 'ISPS code'),
    ('Ship Safety Officer', '', 'IMO Assembly Res A.741(18)'),
    ('ISF Marlins English test', '', 'UK MCA')
),
normalized_courses as (
  select
    ad.id,
    jsonb_agg(
      jsonb_build_object(
        'courseName', coalesce(course_item->>'courseName', ''),
        'imoModelCourse', coalesce(cm.imo_model_course, ''),
        'referenceRegulation', coalesce(cm.reference_regulation, ''),
        'certificateNumber', coalesce(course_item->>'certificateNumber', ''),
        'dateOfIssue', coalesce(course_item->>'dateOfIssue', ''),
        'dateOfExpiry', coalesce(course_item->>'dateOfExpiry', '')
      )
      order by course_ordinality
    ) as courses
  from public.application_data ad
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(ad.data->'section14'->'courses') = 'array' then ad.data->'section14'->'courses'
      else '[]'::jsonb
    end
  ) with ordinality as course(course_item, course_ordinality)
  left join course_mapping cm
    on cm.course_name = course_item->>'courseName'
  where ad.data ? 'section14'
  group by ad.id
)
update public.application_data ad
set data = jsonb_set(ad.data, '{section14,courses}', nc.courses, true)
from normalized_courses nc
where ad.id = nc.id;
