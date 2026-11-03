-- STAGING ONLY. Fills the synthetic applicant's draft with a complete, valid long
-- form so "Review & submit" can be tested without typing 13 sections.
-- Checked against src/utils/sectionValidation.js (all 13 mandatory sections pass).
-- Keeps the draft's uploaded photo. Run in holmes-staging's SQL editor, never production.

do $$
declare
  draft_id uuid;
begin
  -- Guard: only run where the staging recruiter account exists.
  if not exists (select 1 from public.profiles where lower(email) = 'recruiter-staging@example.com') then
    raise exception 'This does not look like holmes-staging; stopping.';
  end if;

  select a.id into draft_id
  from public.applications a
  join public.profiles p on p.id = a.user_id
  where lower(p.email) = 'kartik.hth+holmes-applicant@gmail.com'
    and a.submitted_at is null
  order by a.created_at desc
  limit 1;

  if draft_id is null then
    raise exception 'No unsubmitted draft for kartik.hth+holmes-applicant@gmail.com';
  end if;

  update public.application_data d
  set data = jsonb_set(
        '{
  "section1": {
    "appliedForRank": "Chief Officer",
    "vesselType": "Tanker",
    "availableFrom": "2026-12-01",
    "availableTill": "2027-06-30",
    "mediaAdvertisement": false,
    "professionalRecommendation": false
  },
  "section2": {
    "surname": "Applicant",
    "firstName": "Staging",
    "nationality": "Indian",
    "placeOfBirth": "Mumbai",
    "dateOfBirth": "1988-04-12",
    "age": "38",
    "gender": "Male",
    "email": "kartik.hth+holmes-applicant@gmail.com",
    "phoneCountryCode": "+91",
    "phoneNumber": "9800000000",
    "address": "1 Test Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "country": "India",
    "postalCode": "400001",
    "domesticAirport": "Mumbai",
    "internationalAirport": "Mumbai",
    "maritalStatus": "Single",
    "nextOfKin": {
      "name": "Test Kin",
      "relationship": "Parent"
    },
    "emergencyContact": {
      "name": "Test Contact",
      "relationship": "Sibling",
      "address": "1 Test Street, Mumbai",
      "phone": "+91 9800000001"
    }
  },
  "section3": {
    "passportNumber": "Z0000001",
    "placeOfIssue": "Mumbai",
    "dateOfIssue": "2021-03-14",
    "dateOfExpiry": "2031-03-13",
    "issuingAuthority": "Govt of India"
  },
  "section4": {
    "cdcNumber": "MUM000001",
    "placeOfIssue": "Mumbai",
    "dateOfIssue": "2020-01-10",
    "dateOfExpiry": "2030-01-09",
    "issuingAuthority": "DG Shipping"
  },
  "section6": {
    "education": [
      {
        "institution": "Test Maritime Academy",
        "qualification": "B.Sc Nautical Science",
        "from": "2006-07-01",
        "to": "2009-06-30"
      }
    ]
  },
  "section8": {
    "certificates": [
      {
        "grade": "Chief Mate",
        "certificateNumber": "COC000001",
        "issuingAuthority": "DG Shipping",
        "placeOfIssue": "Mumbai",
        "dateOfIssue": "2022-05-01",
        "dateOfExpiry": "2027-04-30"
      }
    ]
  },
  "section10": {
    "medicalFitness": [
      {
        "type": "PEME",
        "dateOfIssue": "2026-01-15",
        "dateOfExpiry": "2027-01-14"
      }
    ],
    "vaccinations": {
      "yellowFever": {
        "received": true,
        "dateOfIssue": "2015-02-01",
        "dateOfExpiry": "",
        "lifetimeValidity": true
      }
    }
  },
  "section11": {
    "medicalHistory": {
      "signedOffMedical": false,
      "vesselName": "",
      "dateOfOccurrence": "",
      "description": ""
    }
  },
  "section13": {
    "height": "178",
    "heightUnit": "cm",
    "weight": "76",
    "weightUnit": "kg",
    "shoeSize": "9",
    "shoeSizeUnit": "UK",
    "boilerSuitSize": "L"
  },
  "section14": {
    "courses": [
      {
        "courseName": "Basic Training",
        "certificateNumber": "BT000001",
        "dateOfIssue": "2022-02-01",
        "dateOfExpiry": "2027-01-31"
      }
    ]
  },
  "section16": {
    "seaService": [
      {
        "vesselName": "Test Voyager",
        "vesselType": "Tanker",
        "flag": "Liberia",
        "grt": "42000",
        "teu": "0",
        "dwt": "74000",
        "yearBuilt": "2012",
        "mainEngine": "2-stroke",
        "engineFamily": "MC",
        "mainEngineMake": "MAN B&W",
        "engineKw": "11000",
        "rankHeld": "Chief Officer",
        "position": "Chief Officer",
        "company": "Test Shipping",
        "manning": "Test Manning",
        "signOnDate": "2025-03-01",
        "signOffDate": "2025-09-01",
        "tradingArea": "Worldwide",
        "tradeRoute": "Worldwide",
        "totalMmDd": "06/00",
        "reasonForLeaving": "Contract completed"
      }
    ]
  },
  "section18": {
    "objectionToContactLastEmployer": "no",
    "currentEmployer": {
      "company": "Test Shipping",
      "contactPerson": "Test Superintendent",
      "address": "1 Port Road, Singapore",
      "phoneNumber": "+65 60000000"
    },
    "references": [
      {
        "name": "Ref One",
        "position": "Master",
        "company": "Test Shipping",
        "address": "1 Port Road, Singapore",
        "relationship": "Former master",
        "phoneNumber": "+65 60000001",
        "email": "ref.one@example.com",
        "yearsKnown": "4"
      },
      {
        "name": "Ref Two",
        "position": "Superintendent",
        "company": "Test Shipping",
        "address": "1 Port Road, Singapore",
        "relationship": "Superintendent",
        "phoneNumber": "+65 60000002",
        "email": "ref.two@example.com",
        "yearsKnown": "3"
      }
    ]
  },
  "section19": {
    "accuracyDeclaration": true,
    "backgroundCheckConsent": true,
    "dataProcessingConsent": true,
    "marketingConsent": false,
    "fullName": "Staging Applicant",
    "signatureDate": "2026-11-03",
    "placeOfSigning": "Mumbai"
  }
}'::jsonb,
        '{section2,photoStoragePath}',
        coalesce(d.data -> 'section2' -> 'photoStoragePath', '""'::jsonb)
      ),
      updated_at = now()
  where d.application_id = draft_id;

  raise notice 'Filled draft %', draft_id;
end;
$$;
