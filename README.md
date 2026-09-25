# 5MOBD-SUPINFO : Stockage des photos (MinIO)

Stack Docker qui stocke uniquement les **photos** de l'application **Mes Bonnes Adresses**
(photos de profil, d'adresses et d'avis). Elle remplace Firebase Storage, qui demande le forfait
payant Blaze. Les comptes, adresses et avis restent dans Firebase (Auth et Firestore) : ce dépôt
n'en garde que les images.

## Services

| Service | Rôle | Port |
|---|---|---|
| `minio` | Stockage compatible S3 (console web sur `:9001`) | 9000, 9001 |
| `minio-init` | Job unique : crée le bucket et le rend lisible publiquement (téléchargement anonyme uniquement) | aucun |
| `upload-api` (`server/`) | API Express qui délivre des **URLs d'upload signées valables 5 minutes** ; l'app ne détient jamais la clé secrète | 4000 |

## Démarrage

```bash
cp env.example .env      # optionnel : toutes les valeurs ont un défaut
docker compose up -d
docker compose logs -f
docker compose down      # arrêter (les photos restent dans le volume)
docker compose down -v   # arrêter et effacer toutes les photos
```

Console MinIO : <http://localhost:9001> (par défaut `minioadmin` / `minioadmin123`).
Santé de l'API : <http://localhost:4000/health>.

## Brancher l'application

Dans le `.env` de l'app, pointez vers cette API :

```
EXPO_PUBLIC_UPLOAD_API_URL=http://localhost:4000
```

Et adaptez `MINIO_PUBLIC_ENDPOINT` ici selon la cible (l'app télécharge et envoie directement vers MinIO) :

| Cible | `EXPO_PUBLIC_UPLOAD_API_URL` (app) | `MINIO_PUBLIC_ENDPOINT` (ici) |
|---|---|---|
| Web / simulateur iOS | `http://localhost:4000` | `http://localhost:9000` |
| Émulateur Android | `http://10.0.2.2:4000` | `http://10.0.2.2:9000` |
| Téléphone physique | `http://<IP-LAN>:4000` | `http://<IP-LAN>:9000` |

## API

`POST /presign` avec `{ "path": "profiles/uid.jpg", "contentType": "image/jpeg" }`
→ `{ "uploadUrl": "...", "publicUrl": "..." }`. L'app envoie le fichier avec un `PUT` sur `uploadUrl`
puis enregistre `publicUrl` dans Firestore.

## Limites connues

- `/presign` ne vérifie **aucun jeton d'authentification** : n'importe qui atteignant le service peut
  demander une URL d'upload pour n'importe quel chemin du bucket. Acceptable en local ; avant toute
  exposition publique, il faut vérifier le jeton Firebase de l'utilisateur.
- Les identifiants MinIO par défaut sont publics : changez-les via `.env` hors d'un usage local.
