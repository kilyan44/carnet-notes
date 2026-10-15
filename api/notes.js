import { Redis } from '@upstash/redis';

// Compatible Vercel KV et Upstash Redis direct
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "https://sunny-turkey-147885.upstash.io",
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "gQAAAAAAAkGtAAIgcDIxOGIxOTU1OTQxYWM0ZjJjOGQ0NDBlODNkZmNmNTdmYQ",
});

// Vos notes initiales (chargées depuis notes_rows.json)
const DEFAULT_DATA = {
  "semesters": [
    {
      "id": 431,
      "name": "Semestre 1 (L1)",
      "subjects": [
        {
          "id": 432,
          "p1": "25",
          "p2": "30",
          "p3": "35",
          "p4": "10",
          "cc1": "14.398",
          "cc2": "12.5",
          "cc3": "15",
          "cc4": "9.19",
          "ects": "6",
          "jury": false,
          "name": "Info1.Algo1",
          "moduleId": "info1-algo1"
        },
        {
          "id": 634,
          "p1": "10",
          "p2": "15",
          "p3": "40",
          "p4": "35",
          "cc1": "14",
          "cc2": "14",
          "cc3": "8.25",
          "cc4": "8.25",
          "ects": "6",
          "jury": true,
          "name": "Info1.BAS",
          "moduleId": "info1-bas"
        },
        {
          "id": 642,
          "p1": "15",
          "p2": "40",
          "p3": "45",
          "p4": "0",
          "cc1": "15",
          "cc2": "13.25",
          "cc3": "12.5",
          "cc4": "0",
          "ects": "6",
          "jury": false,
          "name": "Math1.Calc1",
          "moduleId": "math1-calc1"
        },
        {
          "id": 1792,
          "p1": "50",
          "p2": "50",
          "p3": "0",
          "p4": "0",
          "cc1": "10.14",
          "cc2": "10.41",
          "cc3": "",
          "cc4": "",
          "ects": "3",
          "jury": false,
          "name": "Sciences du numérique ",
          "moduleId": "choix-libre"
        },
        {
          "id": 2077,
          "p1": "35",
          "p2": "25",
          "p3": "40",
          "p4": "0",
          "cc1": "15",
          "cc2": "11.2",
          "cc3": "11.62",
          "cc4": "",
          "ects": "3",
          "jury": false,
          "name": "DVE",
          "moduleId": "dve"
        },
        {
          "id": 6321,
          "p1": "",
          "p2": "",
          "p3": "",
          "p4": "",
          "cc1": "12.5",
          "cc2": "12.5",
          "cc3": "2",
          "cc4": "9.485",
          "ects": "6",
          "jury": false,
          "name": "Math1.Bases2",
          "moduleId": "math1-bases2"
        }
      ]
    },
    {
      "id": 2651,
      "name": "Semestre 2 (L1)",
      "subjects": [
        {
          "id": 2652,
          "p1": "25",
          "p2": "25",
          "p3": "25",
          "p4": "25",
          "cc1": "14.5",
          "cc2": "9.86",
          "cc3": "11.25",
          "cc4": "7",
          "ects": "6",
          "jury": false,
          "name": "Info2.progC",
          "moduleId": "info2-progc"
        },
        {
          "id": 2797,
          "p1": "30",
          "p2": "30",
          "p3": "30",
          "p4": "10",
          "cc1": "4.5",
          "cc2": "12",
          "cc3": "14.5",
          "cc4": "8",
          "ects": "6",
          "jury": false,
          "name": "Math1.AL",
          "moduleId": "math1-al"
        },
        {
          "id": 3242,
          "p1": "33",
          "p2": "33",
          "p3": "33",
          "p4": "1",
          "cc1": "13.94",
          "cc2": "7.85",
          "cc3": "13.4",
          "cc4": "0",
          "ects": "6",
          "jury": false,
          "name": "Info2.ILU1",
          "moduleId": "info2-ilu1"
        },
        {
          "id": 3449,
          "p1": "20",
          "p2": "30",
          "p3": "0",
          "p4": "50",
          "cc1": "14.38",
          "cc2": "19.06",
          "cc3": "",
          "cc4": "17.02",
          "ects": "3",
          "jury": false,
          "name": "Projet",
          "moduleId": "choix-libre"
        },
        {
          "id": 3768,
          "p1": "25",
          "p2": "25",
          "p3": "0",
          "p4": "50",
          "cc1": "12",
          "cc2": "20",
          "cc3": "",
          "cc4": "9",
          "ects": "3",
          "jury": false,
          "name": "Langue1",
          "moduleId": "langue1"
        },
        {
          "id": 4617,
          "p1": "0",
          "p2": "0",
          "p3": "0",
          "p4": "100",
          "cc1": "12.5",
          "cc2": "12.5",
          "cc3": "0",
          "cc4": "8.93",
          "ects": "6",
          "jury": true,
          "name": "Math1. Bases2",
          "moduleId": "math1-bases2"
        }
      ]
    },
    {
      "id": 4557,
      "name": "Semestre 3 (L1/L2)",
      "subjects": [
        {
          "id": 4558,
          "p1": "25",
          "p2": "25",
          "p3": "25",
          "p4": "25",
          "cc1": "10.375",
          "cc2": "15.294",
          "cc3": "15.3",
          "cc4": "8.25",
          "ects": "6",
          "jury": false,
          "name": "Info3.SR1",
          "moduleId": "info3-sr1"
        },
        {
          "id": 4773,
          "p1": "",
          "p2": "",
          "p3": "",
          "p4": "",
          "cc1": "0",
          "cc2": "9.33",
          "cc3": "7",
          "cc4": "7.5",
          "ects": "6",
          "jury": false,
          "name": "Info3.Archi",
          "moduleId": "info3-archi"
        },
        {
          "id": 4836,
          "p1": "20",
          "p2": "30",
          "p3": "30",
          "p4": "20",
          "cc1": "18",
          "cc2": "12.47",
          "cc3": "10.65",
          "cc4": "6.5",
          "ects": "6",
          "jury": false,
          "name": "Info1.DS1",
          "moduleId": "info1-ds1"
        },
        {
          "id": 5425,
          "p1": "",
          "p2": "",
          "p3": "",
          "p4": "0",
          "cc1": "3",
          "cc2": "8.5",
          "cc3": "7.5",
          "cc4": "2.5",
          "ects": "6",
          "jury": false,
          "name": "Math2.Bases3",
          "moduleId": "math2-bases3"
        },
        {
          "id": 6060,
          "p1": "25",
          "p2": "25",
          "p3": "50",
          "p4": "",
          "cc1": "16",
          "cc2": "16.66",
          "cc3": "15",
          "cc4": "",
          "ects": "3",
          "jury": false,
          "name": "Espagnol débutant ",
          "moduleId": "choix-libre"
        },
        {
          "id": 6299,
          "p1": "60",
          "p2": "5",
          "p3": "35",
          "p4": "0",
          "cc1": "18.69",
          "cc2": "17",
          "cc3": "18.5",
          "cc4": "",
          "ects": "3",
          "jury": false,
          "name": "Langue2.1",
          "moduleId": "langue2-1"
        }
      ]
    },
    {
      "id": 6754,
      "name": "Semestre 4 (L2)",
      "subjects": [
        {
          "id": 6755,
          "p1": "25",
          "p2": "25",
          "p3": "25",
          "p4": "25",
          "cc1": "17",
          "cc2": "14",
          "cc3": "7",
          "cc4": "9",
          "ects": "6",
          "jury": false,
          "name": "Info3.Archi",
          "moduleId": "info3-archi"
        },
        {
          "id": 6830,
          "p1": "25",
          "p2": "25",
          "p3": "50",
          "p4": "0",
          "cc1": "10.6",
          "cc2": "11.5",
          "cc3": "15.5",
          "cc4": "",
          "ects": "6",
          "jury": false,
          "name": "Math2.Bases3",
          "moduleId": "math2-bases3"
        },
        {
          "id": 6929,
          "p1": "30",
          "p2": "40",
          "p3": "30",
          "p4": "0",
          "cc1": "13",
          "cc2": "13",
          "cc3": "8",
          "cc4": "",
          "ects": "3",
          "jury": false,
          "name": "Économie ",
          "moduleId": "choix-libre"
        },
        {
          "id": 7232,
          "p1": "40",
          "p2": "25",
          "p3": "35",
          "p4": "0",
          "cc1": "17.39",
          "cc2": "19",
          "cc3": "0",
          "cc4": "",
          "ects": "3",
          "jury": false,
          "name": "Langue2.2",
          "moduleId": "langue2-2"
        },
        {
          "id": 7240,
          "p1": "25",
          "p2": "25",
          "p3": "25",
          "p4": "25",
          "cc1": "3",
          "cc2": "11.48",
          "cc3": "11.938",
          "cc4": "8.25",
          "ects": "6",
          "jury": true,
          "name": "Info2.SR2",
          "moduleId": "info4-sr2"
        },
        {
          "id": 7413,
          "p1": "25",
          "p2": "25",
          "p3": "25",
          "p4": "25",
          "cc1": "14.25",
          "cc2": "17",
          "cc3": "18",
          "cc4": "12.5",
          "ects": "6",
          "jury": false,
          "name": "Info2.DS2",
          "moduleId": "info2-ds2"
        }
      ]
    },
    {
      "id": 7568,
      "name": "Semestre 5 (L2)",
      "subjects": [
        {
          "id": 7569,
          "p1": "20",
          "p2": "30",
          "p3": "20",
          "p4": "30",
          "cc1": "9.25",
          "cc2": "10",
          "cc3": "18",
          "cc4": "6.5",
          "ects": "6",
          "jury": false,
          "name": "Info2.Algo2",
          "moduleId": "info2-algo2"
        },
        {
          "id": 7649,
          "p1": "20",
          "p2": "20",
          "p3": "20",
          "p4": "40",
          "cc1": "9.5",
          "cc2": "14",
          "cc3": "11.5",
          "cc4": "9.75",
          "ects": "6",
          "jury": false,
          "name": "Info3.DS3",
          "moduleId": "info3-ds3"
        },
        {
          "id": 8082,
          "p1": "30",
          "p2": "30",
          "p3": "30",
          "p4": "10",
          "cc1": "14.75",
          "cc2": "11",
          "cc3": "9",
          "cc4": "8.5",
          "ects": "6",
          "jury": false,
          "name": "Info3.BD",
          "moduleId": "info3-bd"
        },
        {
          "id": 8303,
          "p1": "25",
          "p2": "25",
          "p3": "0",
          "p4": "50",
          "cc1": "17.5",
          "cc2": "11",
          "cc3": "",
          "cc4": "15",
          "ects": "3",
          "jury": false,
          "name": "Allemand ",
          "moduleId": "choix-libre"
        }
      ]
    },
    {
      "id": 69,
      "name": "Semestre 6 (L3)",
      "subjects": [
        {
          "id": 70,
          "p1": "25",
          "p2": "25",
          "p3": "25",
          "p4": "25",
          "cc1": "10",
          "cc2": "11.75",
          "cc3": "14",
          "cc4": "4.25",
          "ects": "6",
          "name": "Algo 3",
          "moduleId": "info3-algo3"
        },
        {
          "id": 151,
          "p1": "25",
          "p2": "25",
          "p3": "25",
          "p4": "25",
          "cc1": "8.5",
          "cc2": "12.5",
          "cc3": "13.5",
          "cc4": "9.25",
          "ects": "6",
          "name": "Intelligence Artificielle",
          "moduleId": "info4-ia"
        },
        {
          "id": 248,
          "p1": "25",
          "p2": "49",
          "p3": "25",
          "p4": "1",
          "cc1": "15.4",
          "cc2": "12.13",
          "cc3": "13.5",
          "cc4": "1.9",
          "ects": "6",
          "name": "ILU 2",
          "moduleId": "info3-ilu2"
        },
        {
          "id": 395,
          "p1": "30",
          "p2": "40",
          "p3": "0",
          "p4": "30",
          "cc1": "13",
          "cc2": "17",
          "cc3": "",
          "cc4": "15",
          "ects": "3",
          "jury": false,
          "name": "Méthode numérique sous python (option)",
          "moduleId": "choix-libre"
        }
      ]
    }
  ]
};

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      let data = await redis.get('notes_data');
      if (!data) {
        // Initialisation automatique de la base Upstash
        await redis.set('notes_data', DEFAULT_DATA);
        data = DEFAULT_DATA;
      }
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const payload = req.body;
      await redis.set('notes_data', payload);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (error) {
    console.error('Erreur Redis/Upstash:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}
