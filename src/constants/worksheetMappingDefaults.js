function createField(sectionKey, sectionLabel, fieldKey, fieldLabel, sourcePath, sheetName, cellRef, transform, sortOrder) {
  return {
    sectionKey,
    sectionLabel,
    fieldKey,
    fieldLabel,
    sourcePath,
    sheetName,
    cellRef,
    transform,
    sortOrder,
  }
}

const SHARED_WORKSHEET_FIELDS = [
  createField('main-application', 'Main: Application Details', 'section1.appliedForRank', 'Applied For Rank', 'section1.appliedForRank', 'Main', 'C16', '', 10),
  createField('main-application', 'Main: Application Details', 'section1.vesselType', 'Vessel Type', 'section1.vesselType', 'Main', 'C17', '', 20),
  createField('main-application', 'Main: Application Details', 'section1.availableFrom', 'Available From', 'section1.availableFrom', 'Main', 'C18', 'ddmmyyyy', 30),
  createField('main-application', 'Main: Application Details', 'section1.mediaAdvertisement', 'Media Advertisement', 'section1.mediaAdvertisement', 'Main', 'E20', 'yes_no', 40),
  createField('main-application', 'Main: Application Details', 'section1.professionalRecommendation', 'Professional Recommendation', 'section1.professionalRecommendation', 'Main', 'F23', 'yes_no', 50),

  createField('main-personal', 'Main: Personal Details', 'section2.surname', 'Surname', 'section2.surname', 'Main', 'C26', '', 10),
  createField('main-personal', 'Main: Personal Details', 'section2.firstName', 'First Name', 'section2.firstName', 'Main', 'F26', '', 20),
  createField('main-personal', 'Main: Personal Details', 'section2.middleName', 'Middle Name', 'section2.middleName', 'Main', 'G26', '', 30),
  createField('main-personal', 'Main: Personal Details', 'section2.otherNames', 'Other Names', 'section2.otherNames', 'Main', 'C27', '', 40),
  createField('main-personal', 'Main: Personal Details', 'section2.nationality', 'Nationality', 'section2.nationality', 'Main', 'F27', '', 50),
  createField('main-personal', 'Main: Personal Details', 'section2.placeOfBirth', 'Place Of Birth', 'section2.placeOfBirth', 'Main', 'B28', '', 60),
  createField('main-personal', 'Main: Personal Details', 'section2.dateOfBirth', 'Age From Date Of Birth', 'section2.dateOfBirth', 'Main', 'F28', 'integer', 70),
  createField('main-personal', 'Main: Personal Details', 'section2.gender', 'Gender', 'section2.gender', 'Main', 'H28', '', 80),

  createField('main-passport', 'Main: Passport', 'section3.passportNumber', 'Passport Number', 'section3.passportNumber', 'Main', 'A32', 'alphanumeric', 10),
  createField('main-passport', 'Main: Passport', 'section3.placeOfIssue', 'Passport Place Of Issue', 'section3.placeOfIssue', 'Main', 'C32', '', 20),
  createField('main-passport', 'Main: Passport', 'section3.dateOfIssue', 'Passport Date Of Issue', 'section3.dateOfIssue', 'Main', 'D32', 'date_serial', 30),
  createField('main-passport', 'Main: Passport', 'section3.dateOfExpiry', 'Passport Date Of Expiry', 'section3.dateOfExpiry', 'Main', 'E32', 'ddmmyyyy', 40),
  createField('main-passport', 'Main: Passport', 'section3.issuingAuthority', 'Passport Issuing Authority', 'section3.issuingAuthority', 'Main', 'G32', '', 50),

  createField('main-contact', 'Main: Personal Contact', 'section2.fullAddress', 'Full Address', 'section2.address|section2.city|section2.state', 'Main', 'B49', 'concat_address_uppercase', 10),
  createField('main-contact', 'Main: Personal Contact', 'section2.postalCode', 'Postal Code', 'section2.postalCode', 'Main', 'B50', 'numeric', 20),
  createField('main-contact', 'Main: Personal Contact', 'section2.country', 'Country', 'section2.country', 'Main', 'F50', '', 30),
  createField('main-contact', 'Main: Personal Contact', 'section2.email', 'Email Address', 'section2.email', 'Main', 'B51', 'text', 40),
  createField('main-contact', 'Main: Personal Contact', 'section2.homeTelephoneNumber', 'Home Telephone Number', 'section2.homeTelephoneNumber', 'Main', 'C52', 'numeric', 50),
  createField('main-contact', 'Main: Personal Contact', 'section2.mobilePhone', 'Mobile Phone Number', 'section2.phoneCountryCode|section2.phoneNumber', 'Main', 'C53', 'concat_numeric', 60),
  createField('main-contact', 'Main: Personal Contact', 'section2.domesticAirport', 'Domestic Airport', 'section2.domesticAirport', 'Main', 'B54', '', 70),
  createField('main-contact', 'Main: Personal Contact', 'section2.internationalAirport', 'International Airport', 'section2.internationalAirport', 'Main', 'G54', '', 80),

  createField('main-emergency', 'Main: Emergency Contact', 'section2.emergencyContact.name', 'Emergency Contact Name', 'section2.emergencyContact.name', 'Main', 'B57', '', 10),
  createField('main-emergency', 'Main: Emergency Contact', 'section2.emergencyContact.relationship', 'Emergency Contact Relationship', 'section2.emergencyContact.relationship', 'Main', 'F57', '', 20),
  createField('main-emergency', 'Main: Emergency Contact', 'section2.emergencyContact.phone', 'Emergency Contact Phone', 'section2.emergencyContact.phone', 'Main', 'C59', 'numeric', 30),
  createField('main-emergency', 'Main: Emergency Contact', 'section2.emergencyContact.mobile', 'Emergency Contact Mobile', 'section2.emergencyContact.mobile', 'Main', 'G59', 'numeric', 40),

  createField('main-seamans-book', 'Main: National Seaman\'s Book', 'section4.cdcNumber', 'Seaman\'s Book Number', 'section4.cdcNumber', 'Main', 'A63', 'alphanumeric', 10),
  createField('main-seamans-book', 'Main: National Seaman\'s Book', 'section4.placeOfIssue', 'Seaman\'s Book Place Of Issue', 'section4.placeOfIssue', 'Main', 'B63', '', 20),
  createField('main-seamans-book', 'Main: National Seaman\'s Book', 'section4.dateOfIssue', 'Seaman\'s Book Date Of Issue', 'section4.dateOfIssue', 'Main', 'D63', 'ddmmyyyy', 30),
  createField('main-seamans-book', 'Main: National Seaman\'s Book', 'section4.dateOfExpiry', 'Seaman\'s Book Date Of Expiry', 'section4.dateOfExpiry', 'Main', 'E63', 'ddmmyyyy', 40),
  createField('main-seamans-book', 'Main: National Seaman\'s Book', 'section4.issuingAuthority', 'Seaman\'s Book Issuing Authority', 'section4.issuingAuthority', 'Main', 'G63', '', 50),

  createField('main-gmdss', 'Main: GMDSS', 'section9.gmdss.latest.issuingAuthority', 'GMDSS Issuing Authority', 'gmdss_latest:issuingAuthority', 'Main', 'A72', '', 10),
  createField('main-gmdss', 'Main: GMDSS', 'section9.gmdss.latest.number', 'GMDSS Number', 'gmdss_latest:number', 'Main', 'C72', 'alphanumeric', 20),
  createField('main-gmdss', 'Main: GMDSS', 'section9.gmdss.latest.dateOfIssue', 'GMDSS Date Of Issue', 'gmdss_latest:dateOfIssue', 'Main', 'D72', 'ddmmyyyy', 30),
  createField('main-gmdss', 'Main: GMDSS', 'section9.gmdss.latest.dateOfExpiry', 'GMDSS Date Of Expiry', 'gmdss_latest:dateOfExpiry', 'Main', 'E72', 'ddmmyyyy', 40),
  createField('main-gmdss', 'Main: GMDSS', 'section9.gmdss.latest.placeOfIssue', 'GMDSS Place Of Issue', 'gmdss_latest:placeOfIssue', 'Main', 'G72', '', 50),

  createField('end-references', 'End: References', 'section18.objectionToContactLastEmployer', 'Objection To Contact Last Employer', 'section18.objectionToContactLastEmployer', 'End', 'H19', 'yes_no_text', 10),
  createField('end-references', 'End: References', 'section18.currentEmployer.company', 'Current Employer Company', 'section18.currentEmployer.company', 'End', 'C24', '', 20),
  createField('end-references', 'End: References', 'section18.currentEmployer.contactPerson', 'Current Employer Contact Person', 'section18.currentEmployer.contactPerson', 'End', 'C25', '', 30),
  createField('end-references', 'End: References', 'section18.currentEmployer.address.line1', 'Current Employer Address Line 1', 'section18.currentEmployer.address', 'End', 'C26', 'split_merged', 40),
  createField('end-references', 'End: References', 'section18.currentEmployer.address.line2', 'Current Employer Address Line 2', 'section18.currentEmployer.address', 'End', 'C27', 'split_merged', 50),
  createField('end-references', 'End: References', 'section18.currentEmployer.phoneNumber', 'Current Employer Telephone', 'section18.currentEmployer.phoneNumber', 'End', 'C28', 'numeric', 60),
  createField('end-references', 'End: References', 'section18.references[0].company', 'Referee 1 Company', 'section18.references[0].company', 'End', 'C31', '', 70),
  createField('end-references', 'End: References', 'section18.references[0].name', 'Referee 1 Contact Name', 'section18.references[0].name', 'End', 'C32', '', 80),
  createField('end-references', 'End: References', 'section18.references[0].address.line1', 'Referee 1 Address Line 1', 'section18.references[0].address', 'End', 'C33', 'split_merged', 90),
  createField('end-references', 'End: References', 'section18.references[0].address.line2', 'Referee 1 Address Line 2', 'section18.references[0].address', 'End', 'C34', 'split_merged', 100),
  createField('end-references', 'End: References', 'section18.references[0].phoneNumber', 'Referee 1 Telephone', 'section18.references[0].phoneNumber', 'End', 'C35', 'numeric', 110),
  createField('end-references', 'End: References', 'section18.references[1].company', 'Referee 2 Company', 'section18.references[1].company', 'End', 'C36', '', 120),
  createField('end-references', 'End: References', 'section18.references[1].name', 'Referee 2 Contact Name', 'section18.references[1].name', 'End', 'C37', '', 130),
  createField('end-references', 'End: References', 'section18.references[1].address.line1', 'Referee 2 Address Line 1', 'section18.references[1].address', 'End', 'C38', 'split_merged', 140),
  createField('end-references', 'End: References', 'section18.references[1].address.line2', 'Referee 2 Address Line 2', 'section18.references[1].address', 'End', 'C39', 'split_merged', 150),
  createField('end-references', 'End: References', 'section18.references[1].phoneNumber', 'Referee 2 Telephone', 'section18.references[1].phoneNumber', 'End', 'C40', 'numeric', 160),
  createField('end-references', 'End: References', 'system.currentDate', 'Current Date Stamp', 'system.currentDate', 'End', 'A45', 'date_label', 170),
]

export function getWorksheetMappingDefaults() {
  return SHARED_WORKSHEET_FIELDS
}
