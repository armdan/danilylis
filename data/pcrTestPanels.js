// data/pcrTestPanels.js
const pcrTestPanels = [
  {
    testCode: 'PCR-UTI-01',
    testName: 'Urinary Tract Infection PCR Panel',
    shortName: 'UTI',
    description: 'Comprehensive molecular detection of urinary pathogens and antibiotic resistance markers',
    panel: 'UTI',
    sampleTypes: ['urine'],
    preferredSampleType: 'urine',
    price: 250,
    targets: [
      // Bacteria - Gram Negative
      { name: 'Escherichia coli', category: 'bacteria', clinicalSignificance: 'Most common UTI pathogen' },
      { name: 'Klebsiella pneumoniae', category: 'bacteria', clinicalSignificance: 'Common nosocomial pathogen' },
      { name: 'Proteus mirabilis', category: 'bacteria', clinicalSignificance: 'Associated with kidney stones' },
      { name: 'Pseudomonas aeruginosa', category: 'bacteria', clinicalSignificance: 'Often multidrug resistant' },
      { name: 'Enterobacter cloacae', category: 'bacteria', clinicalSignificance: 'Healthcare-associated infections' },
      { name: 'Citrobacter freundii', category: 'bacteria', clinicalSignificance: 'Opportunistic pathogen' },
      { name: 'Morganella morganii', category: 'bacteria', clinicalSignificance: 'Catheter-associated UTI' },
      { name: 'Acinetobacter baumannii', category: 'bacteria', clinicalSignificance: 'MDR concern' },
      // Bacteria - Gram Positive
      { name: 'Enterococcus faecalis', category: 'bacteria', clinicalSignificance: 'Common in complicated UTI' },
      { name: 'Enterococcus faecium', category: 'bacteria', clinicalSignificance: 'Often vancomycin resistant' },
      { name: 'Staphylococcus saprophyticus', category: 'bacteria', clinicalSignificance: 'Young women UTI' },
      { name: 'Group B Streptococcus', category: 'bacteria', clinicalSignificance: 'Pregnancy concern' },
      // Fungi
      { name: 'Candida albicans', category: 'fungus', clinicalSignificance: 'Most common fungal UTI' },
      { name: 'Candida glabrata', category: 'fungus', clinicalSignificance: 'Azole resistance concern' }
    ],
    resistanceMarkers: [
      { marker: 'CTX-M', gene: 'blaCTX-M', antibioticClass: ['Cephalosporins'], clinicalImplication: 'ESBL producer' },
      { marker: 'KPC', gene: 'blaKPC', antibioticClass: ['Carbapenems'], clinicalImplication: 'Carbapenem resistance' },
      { marker: 'NDM', gene: 'blaNDM', antibioticClass: ['Carbapenems'], clinicalImplication: 'Metallo-beta-lactamase' },
      { marker: 'VIM', gene: 'blaVIM', antibioticClass: ['Carbapenems'], clinicalImplication: 'Carbapenem resistance' },
      { marker: 'OXA-48', gene: 'blaOXA-48', antibioticClass: ['Carbapenems'], clinicalImplication: 'Carbapenem resistance' },
      { marker: 'mecA', gene: 'mecA', antibioticClass: ['Beta-lactams'], clinicalImplication: 'Methicillin resistance' },
      { marker: 'vanA', gene: 'vanA', antibioticClass: ['Glycopeptides'], clinicalImplication: 'Vancomycin resistance' },
      { marker: 'vanB', gene: 'vanB', antibioticClass: ['Glycopeptides'], clinicalImplication: 'Vancomycin resistance' }
    ],
    billingCodes: {
      cptCode: '87507',
      loincCode: '92130-7'
    }
  },
  {
    testCode: 'PCR-NAIL-01',
    testName: 'Nail Fungus (Onychomycosis) PCR Panel',
    shortName: 'Nail Fungus',
    description: 'Molecular detection of dermatophytes and other nail pathogens',
    panel: 'Nail_Fungus',
    sampleTypes: ['nail_clipping'],
    preferredSampleType: 'nail_clipping',
    price: 195,
    targets: [
      // Dermatophytes
      { name: 'Trichophyton rubrum', category: 'fungus', clinicalSignificance: 'Most common nail fungus' },
      { name: 'Trichophyton mentagrophytes', category: 'fungus', clinicalSignificance: 'Common dermatophyte' },
      { name: 'Trichophyton interdigitale', category: 'fungus', clinicalSignificance: 'Toe web infection' },
      { name: 'Epidermophyton floccosum', category: 'fungus', clinicalSignificance: 'Skin and nail infection' },
      { name: 'Microsporum canis', category: 'fungus', clinicalSignificance: 'Zoonotic dermatophyte' },
      { name: 'Microsporum gypseum', category: 'fungus', clinicalSignificance: 'Soil-borne dermatophyte' },
      // Non-dermatophyte molds
      { name: 'Scopulariopsis brevicaulis', category: 'fungus', clinicalSignificance: 'Non-dermatophyte onychomycosis' },
      { name: 'Aspergillus species', category: 'fungus', clinicalSignificance: 'Secondary invader' },
      { name: 'Fusarium species', category: 'fungus', clinicalSignificance: 'Resistant to many antifungals' },
      { name: 'Acremonium species', category: 'fungus', clinicalSignificance: 'White superficial onychomycosis' },
      // Yeasts
      { name: 'Candida albicans', category: 'fungus', clinicalSignificance: 'Yeast onychomycosis' },
      { name: 'Candida parapsilosis', category: 'fungus', clinicalSignificance: 'Fingernail infections' }
    ],
    resistanceMarkers: [], // Antifungal resistance testing typically done separately
    billingCodes: {
      cptCode: '87101',
      loincCode: '90430-1'
    }
  },
  {
    testCode: 'PCR-PNEU-01',
    testName: 'Pneumonia PCR Panel',
    shortName: 'Pneumonia',
    description: 'Comprehensive respiratory pathogen detection including atypical bacteria',
    panel: 'Pneumonia',
    sampleTypes: ['sputum', 'bronchial_wash'],
    preferredSampleType: 'sputum',
    price: 325,
    targets: [
      // Typical bacteria
      { name: 'Streptococcus pneumoniae', category: 'bacteria', clinicalSignificance: 'Most common CAP' },
      { name: 'Haemophilus influenzae', category: 'bacteria', clinicalSignificance: 'Common in COPD' },
      { name: 'Moraxella catarrhalis', category: 'bacteria', clinicalSignificance: 'COPD exacerbations' },
      { name: 'Staphylococcus aureus', category: 'bacteria', clinicalSignificance: 'Post-viral pneumonia' },
      { name: 'Klebsiella pneumoniae', category: 'bacteria', clinicalSignificance: 'Severe pneumonia' },
      { name: 'Pseudomonas aeruginosa', category: 'bacteria', clinicalSignificance: 'HAP/VAP pathogen' },
      // Atypical bacteria
      { name: 'Mycoplasma pneumoniae', category: 'bacteria', clinicalSignificance: 'Atypical pneumonia' },
      { name: 'Chlamydia pneumoniae', category: 'bacteria', clinicalSignificance: 'Walking pneumonia' },
      { name: 'Legionella pneumophila', category: 'bacteria', clinicalSignificance: 'Legionnaires disease' },
      // Viruses
      { name: 'Influenza A', category: 'virus', clinicalSignificance: 'Seasonal flu' },
      { name: 'Influenza B', category: 'virus', clinicalSignificance: 'Seasonal flu' },
      { name: 'RSV', category: 'virus', clinicalSignificance: 'Bronchiolitis' },
      { name: 'SARS-CoV-2', category: 'virus', clinicalSignificance: 'COVID-19' },
      { name: 'Adenovirus', category: 'virus', clinicalSignificance: 'Pneumonia in immunocompromised' },
      { name: 'Human Metapneumovirus', category: 'virus', clinicalSignificance: 'Pediatric pneumonia' }
    ],
    resistanceMarkers: [
      { marker: 'mecA', gene: 'mecA', antibioticClass: ['Beta-lactams'], clinicalImplication: 'MRSA' },
      { marker: 'ermB', gene: 'ermB', antibioticClass: ['Macrolides'], clinicalImplication: 'Macrolide resistance' },
      { marker: 'mefA', gene: 'mefA', antibioticClass: ['Macrolides'], clinicalImplication: 'Macrolide efflux' },
      { marker: 'CTX-M', gene: 'blaCTX-M', antibioticClass: ['Cephalosporins'], clinicalImplication: 'ESBL' },
      { marker: 'KPC', gene: 'blaKPC', antibioticClass: ['Carbapenems'], clinicalImplication: 'Carbapenem resistance' }
    ],
    billingCodes: {
      cptCode: '87633',
      loincCode: '92141-4'
    }
  },
  {
    testCode: 'PCR-WOUND-01',
    testName: 'Wound Infection PCR Panel',
    shortName: 'Wound',
    description: 'Detection of wound pathogens including MRSA and anaerobes',
    panel: 'Wound',
    sampleTypes: ['wound_swab', 'tissue'],
    preferredSampleType: 'wound_swab',
    price: 275,
    targets: [
      // Gram-positive aerobes
      { name: 'Staphylococcus aureus', category: 'bacteria', clinicalSignificance: 'Most common wound pathogen' },
      { name: 'Streptococcus pyogenes', category: 'bacteria', clinicalSignificance: 'Group A Strep' },
      { name: 'Streptococcus agalactiae', category: 'bacteria', clinicalSignificance: 'Group B Strep' },
      { name: 'Enterococcus faecalis', category: 'bacteria', clinicalSignificance: 'Polymicrobial infections' },
      { name: 'Enterococcus faecium', category: 'bacteria', clinicalSignificance: 'Often VRE' },
      // Gram-negative aerobes
      { name: 'Pseudomonas aeruginosa', category: 'bacteria', clinicalSignificance: 'Chronic wounds' },
      { name: 'Escherichia coli', category: 'bacteria', clinicalSignificance: 'Abdominal wounds' },
      { name: 'Klebsiella pneumoniae', category: 'bacteria', clinicalSignificance: 'Nosocomial infections' },
      { name: 'Acinetobacter baumannii', category: 'bacteria', clinicalSignificance: 'Combat wounds' },
      { name: 'Proteus mirabilis', category: 'bacteria', clinicalSignificance: 'Diabetic wounds' },
      // Anaerobes
      { name: 'Bacteroides fragilis', category: 'bacteria', clinicalSignificance: 'Abscess formation' },
      { name: 'Prevotella melaninogenica', category: 'bacteria', clinicalSignificance: 'Mixed infections' },
      { name: 'Clostridium perfringens', category: 'bacteria', clinicalSignificance: 'Gas gangrene' },
      { name: 'Peptostreptococcus species', category: 'bacteria', clinicalSignificance: 'Deep tissue infections' },
      // Fungi
      { name: 'Candida albicans', category: 'fungus', clinicalSignificance: 'Immunocompromised patients' }
    ],
    resistanceMarkers: [
      { marker: 'mecA', gene: 'mecA', antibioticClass: ['Beta-lactams'], clinicalImplication: 'MRSA' },
      { marker: 'mecC', gene: 'mecC', antibioticClass: ['Beta-lactams'], clinicalImplication: 'MRSA variant' },
      { marker: 'vanA', gene: 'vanA', antibioticClass: ['Glycopeptides'], clinicalImplication: 'VRE' },
      { marker: 'vanB', gene: 'vanB', antibioticClass: ['Glycopeptides'], clinicalImplication: 'VRE' },
      { marker: 'CTX-M', gene: 'blaCTX-M', antibioticClass: ['Cephalosporins'], clinicalImplication: 'ESBL' },
      { marker: 'KPC', gene: 'blaKPC', antibioticClass: ['Carbapenems'], clinicalImplication: 'CRE' },
      { marker: 'NDM', gene: 'blaNDM', antibioticClass: ['Carbapenems'], clinicalImplication: 'CRE' }
    ],
    billingCodes: {
      cptCode: '87798',
      loincCode: '90650-4'
    }
  },
  {
    testCode: 'PCR-GI-01',
    testName: 'Gastrointestinal Pathogen PCR Panel',
    shortName: 'GI',
    description: 'Comprehensive detection of bacterial, viral, and parasitic GI pathogens',
    panel: 'GI',
    sampleTypes: ['stool'],
    preferredSampleType: 'stool',
    price: 350,
    targets: [
      // Bacteria
      { name: 'Campylobacter jejuni/coli', category: 'bacteria', clinicalSignificance: 'Most common bacterial gastroenteritis' },
      { name: 'Salmonella species', category: 'bacteria', clinicalSignificance: 'Food poisoning' },
      { name: 'Shigella species', category: 'bacteria', clinicalSignificance: 'Dysentery' },
      { name: 'E. coli O157:H7', category: 'bacteria', clinicalSignificance: 'HUS risk' },
      { name: 'STEC (Shiga toxin E. coli)', category: 'bacteria', clinicalSignificance: 'Hemorrhagic colitis' },
      { name: 'ETEC (Enterotoxigenic E. coli)', category: 'bacteria', clinicalSignificance: 'Travelers diarrhea' },
      { name: 'EAEC (Enteroaggregative E. coli)', category: 'bacteria', clinicalSignificance: 'Persistent diarrhea' },
      { name: 'EPEC (Enteropathogenic E. coli)', category: 'bacteria', clinicalSignificance: 'Infantile diarrhea' },
      { name: 'Clostridioides difficile', category: 'bacteria', clinicalSignificance: 'Antibiotic-associated colitis' },
      { name: 'Vibrio cholerae', category: 'bacteria', clinicalSignificance: 'Cholera' },
      { name: 'Yersinia enterocolitica', category: 'bacteria', clinicalSignificance: 'Mesenteric adenitis' },
      // Viruses
      { name: 'Norovirus GI/GII', category: 'virus', clinicalSignificance: 'Most common viral gastroenteritis' },
      { name: 'Rotavirus', category: 'virus', clinicalSignificance: 'Pediatric diarrhea' },
      { name: 'Adenovirus 40/41', category: 'virus', clinicalSignificance: 'Enteric adenovirus' },
      { name: 'Astrovirus', category: 'virus', clinicalSignificance: 'Pediatric gastroenteritis' },
      { name: 'Sapovirus', category: 'virus', clinicalSignificance: 'Calicivirus gastroenteritis' },
      // Parasites
      { name: 'Giardia lamblia', category: 'parasite', clinicalSignificance: 'Most common intestinal parasite' },
      { name: 'Cryptosporidium species', category: 'parasite', clinicalSignificance: 'Waterborne outbreaks' },
      { name: 'Entamoeba histolytica', category: 'parasite', clinicalSignificance: 'Amebic dysentery' },
      { name: 'Cyclospora cayetanensis', category: 'parasite', clinicalSignificance: 'Traveler diarrhea' }
    ],
    resistanceMarkers: [], // GI panels typically don't include resistance markers
    billingCodes: {
      cptCode: '87507',
      loincCode: '82196-7'
    }
  },
  {
    testCode: 'PCR-RESP-01',
    testName: 'COVID-19/Flu A/B/RSV PCR Panel',
    shortName: 'COVID_FLU_RSV',
    description: 'Multiplex detection of SARS-CoV-2, Influenza A/B, and RSV',
    panel: 'COVID_FLU_RSV',
    sampleTypes: ['nasopharyngeal_swab', 'oropharyngeal_swab'],
    preferredSampleType: 'nasopharyngeal_swab',
    price: 150,
    targets: [
      { name: 'SARS-CoV-2', category: 'virus', gene: 'N gene, E gene', clinicalSignificance: 'COVID-19' },
      { name: 'Influenza A', category: 'virus', gene: 'M gene', clinicalSignificance: 'Seasonal/pandemic flu' },
      { name: 'Influenza B', category: 'virus', gene: 'NS gene', clinicalSignificance: 'Seasonal flu' },
      { name: 'RSV A', category: 'virus', gene: 'N gene', clinicalSignificance: 'Bronchiolitis' },
      { name: 'RSV B', category: 'virus', gene: 'N gene', clinicalSignificance: 'Bronchiolitis' }
    ],
    resistanceMarkers: [], // Viral panels don't include resistance markers
    billingCodes: {
      cptCode: '87637',
      loincCode: '94500-6'
    }
  },
  {
    testCode: 'PCR-STI-01',
    testName: 'Sexually Transmitted Infection PCR Panel',
    shortName: 'STI',
    description: 'Comprehensive STI detection panel',
    panel: 'STI',
    sampleTypes: ['urine', 'wound_swab'],
    preferredSampleType: 'urine',
    price: 225,
    targets: [
      { name: 'Chlamydia trachomatis', category: 'bacteria', clinicalSignificance: 'Most common bacterial STI' },
      { name: 'Neisseria gonorrhoeae', category: 'bacteria', clinicalSignificance: 'Gonorrhea' },
      { name: 'Trichomonas vaginalis', category: 'parasite', clinicalSignificance: 'Trichomoniasis' },
      { name: 'Mycoplasma genitalium', category: 'bacteria', clinicalSignificance: 'Urethritis/cervicitis' },
      { name: 'Mycoplasma hominis', category: 'bacteria', clinicalSignificance: 'PID, BV' },
      { name: 'Ureaplasma urealyticum', category: 'bacteria', clinicalSignificance: 'Urethritis' },
      { name: 'Ureaplasma parvum', category: 'bacteria', clinicalSignificance: 'Urogenital infections' },
      { name: 'HSV-1', category: 'virus', clinicalSignificance: 'Herpes simplex' },
      { name: 'HSV-2', category: 'virus', clinicalSignificance: 'Genital herpes' },
      { name: 'Treponema pallidum', category: 'bacteria', clinicalSignificance: 'Syphilis' },
      { name: 'Haemophilus ducreyi', category: 'bacteria', clinicalSignificance: 'Chancroid' },
      { name: 'Candida species', category: 'fungus', clinicalSignificance: 'Vulvovaginitis' }
    ],
    resistanceMarkers: [
      { marker: 'gyrA mutation', gene: 'gyrA', antibioticClass: ['Fluoroquinolones'], clinicalImplication: 'Ciprofloxacin resistance in N. gonorrhoeae' },
      { marker: '23S rRNA mutation', gene: '23S rRNA', antibioticClass: ['Macrolides'], clinicalImplication: 'Azithromycin resistance' }
    ],
    billingCodes: {
      cptCode: '87801',
      loincCode: '90423-6'
    }
  },
  {
    testCode: 'PCR-RESP-02',
    testName: 'Respiratory Pathogen Panel (Extended)',
    shortName: 'Respiratory',
    description: 'Extended respiratory pathogen panel including common viruses and bacteria',
    panel: 'Respiratory',
    sampleTypes: ['nasopharyngeal_swab', 'oropharyngeal_swab', 'sputum'],
    preferredSampleType: 'nasopharyngeal_swab',
    price: 295,
    targets: [
      // Viruses
      { name: 'Influenza A', category: 'virus', clinicalSignificance: 'Seasonal flu' },
      { name: 'Influenza A H1N1', category: 'virus', clinicalSignificance: 'Pandemic flu' },
      { name: 'Influenza A H3N2', category: 'virus', clinicalSignificance: 'Seasonal flu' },
      { name: 'Influenza B', category: 'virus', clinicalSignificance: 'Seasonal flu' },
      { name: 'RSV A', category: 'virus', clinicalSignificance: 'Bronchiolitis' },
      { name: 'RSV B', category: 'virus', clinicalSignificance: 'Bronchiolitis' },
      { name: 'SARS-CoV-2', category: 'virus', clinicalSignificance: 'COVID-19' },
      { name: 'Parainfluenza 1', category: 'virus', clinicalSignificance: 'Croup' },
      { name: 'Parainfluenza 2', category: 'virus', clinicalSignificance: 'Croup' },
      { name: 'Parainfluenza 3', category: 'virus', clinicalSignificance: 'Bronchiolitis' },
      { name: 'Parainfluenza 4', category: 'virus', clinicalSignificance: 'Mild URI' },
      { name: 'Human Metapneumovirus', category: 'virus', clinicalSignificance: 'Bronchiolitis' },
      { name: 'Rhinovirus/Enterovirus', category: 'virus', clinicalSignificance: 'Common cold' },
      { name: 'Adenovirus', category: 'virus', clinicalSignificance: 'Pharyngitis, pneumonia' },
      { name: 'Coronavirus 229E', category: 'virus', clinicalSignificance: 'Common cold' },
      { name: 'Coronavirus NL63', category: 'virus', clinicalSignificance: 'Croup, bronchiolitis' },
      { name: 'Coronavirus OC43', category: 'virus', clinicalSignificance: 'Common cold' },
      { name: 'Coronavirus HKU1', category: 'virus', clinicalSignificance: 'Pneumonia' },
      { name: 'Human Bocavirus', category: 'virus', clinicalSignificance: 'Respiratory infections' },
      // Bacteria
      { name: 'Bordetella pertussis', category: 'bacteria', clinicalSignificance: 'Whooping cough' },
      { name: 'Bordetella parapertussis', category: 'bacteria', clinicalSignificance: 'Pertussis-like illness' },
      { name: 'Mycoplasma pneumoniae', category: 'bacteria', clinicalSignificance: 'Walking pneumonia' },
      { name: 'Chlamydia pneumoniae', category: 'bacteria', clinicalSignificance: 'Atypical pneumonia' }
    ],
    resistanceMarkers: [],
    billingCodes: {
      cptCode: '87633',
      loincCode: '94309-2'
    }
  }
];

module.exports = pcrTestPanels;