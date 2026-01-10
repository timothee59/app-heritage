# Story 1.2 - Ajouter son prenom si absent

## Epic
Epic 1 : Identification simple

## User Story
**En tant qu'** utilisateur  
**Je veux** ajouter mon prenom s'il n'est pas dans la liste  
**Afin de** pouvoir m'identifier et participer au partage

## Contexte
Si l'utilisateur ne trouve pas son prenom dans la liste, il doit pouvoir l'ajouter avec son role (parent ou enfant).

## Criteres d'Acceptation

- [x] Un bouton "Ajouter mon prenom" est visible sur l'ecran d'identification
- [x] Un formulaire permet de saisir son prenom
- [x] L'utilisateur doit choisir son role (parent ou enfant) avec des boutons clairs
- [x] Apres validation, l'utilisateur est automatiquement identifie et redirige vers la galerie
- [x] Un message d'erreur s'affiche si le prenom existe deja
- [x] Le prenom doit contenir au moins 2 caracteres

## Elements Techniques

### API Endpoint
```
POST /api/users
Body: { name: string, role: "parent" | "enfant" }
-> Retourne le nouvel utilisateur { id, name, role }
```

### Composant Frontend
- Page : `AddUserPage`
- Formulaire avec validation Zod
- Boutons de selection de role (parent/enfant)
- Gestion des erreurs (prenom existant)

### Stockage Local
- Sauvegarder `user_id` dans `localStorage` apres creation

## Maquette Simplifiee

```
+-----------------------------+
|                             |
|    [+] Ajouter mon prenom   |
|                             |
|    Votre prenom             |
|    +---------------------+  |
|    |                     |  |
|    +---------------------+  |
|                             |
|    Vous etes                |
|    +----------+ +----------+|
|    |  Parent  | |  Enfant  ||
|    +----------+ +----------+|
|                             |
|    [Rejoindre la famille]   |
|                             |
|    <- Retour a la liste     |
|                             |
+-----------------------------+
```

## Dependances
- Story 1.1 : Choisir son prenom (doit etre implementee)

## Stories Liees
- 1.1 : Choisir son prenom dans la liste
- 1.3 : Indiquer son role (integre dans cette story)
- 1.4 : Memorisation sur l'appareil
