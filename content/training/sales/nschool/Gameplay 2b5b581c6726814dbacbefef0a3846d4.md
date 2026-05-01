# Gameplay

# Table des matières

---

# Les 3C

### Camera

- **Vue**: 3e personne
- **Perspective**: 3D
- **Réglable**:
    - **Niveau Terrestre**
        
        Caméra contrôlable avec le joystick droit de la manette ou avec la souris. La caméra peut tourner librement autour du personnage. (attention à ce que la caméra ne rentre pas dans le sol)
        
- **Inspiration**:
    
    *“Alba : A Wildlife adventure”*
    
    ![Untitled](Gameplay/Untitled.png)
    
    ![Untitled](Gameplay/Untitled%201.png)
    

### Controls

**Les contrôles manette:**

![Contrôles XBOX](Gameplay/Untitled%202.png)

Contrôles XBOX

![Pour référence dans Unreal](Gameplay/Untitled%203.png)

Pour référence dans Unreal

![Contrôles DualSense](Gameplay/Untitled%204.png)

Contrôles DualSense

| **Actions**  | **XBOX** | **DualSense** | **Clavier + souris** |
| --- | --- | --- | --- |
| Avancer | Joystick L ↑ | Joystick L ↑ | Z |
| Reculer | Joystick L ↓ | Joystick L ↓ | S |
| Tourner à gauche | Joystick L ← | Joystick L ← | Q |
| Tourner à droite | Joystick L → | Joystick L → | D |
| Courir | Joystick L ↑ (full) | Joystick L ↑ (full) | Shift |
| Caméra haut | Joystick R ↑ | Joystick R ↑ | Mouse Up |
| Caméra bas | Joystick R ↓ | Joystick R ↓ | Mouse Down |
| Caméra gauche | Joystick R ← | Joystick R ← | Mouse Left |
| Caméra droite | Joystick R → | Joystick R → | Mouse Right |
| Recentrer la caméra | 9 | R3 | Mouse Wheel  |
| Interagir | Y | △ | E |
| Sauter | A | X | Space |
| Attraper | X | □ | C |
| Annuler | B | ○ | Esc |
| Ouvrir/fermer inventaire | LB | L1 | X |
| Lancer le ver | RB | R2 | Mouse Click Left |
| Ouvrir/fermer menu | 7 | Select | Esc |
| Map | 6 | Pad | M |

- **Feedback**: vibrations (manettes)
- **Collisions de la caméra**: Le sol des îles
- **Aide au joueur**: Auto-lock sur les éléments qu’on peut attraper (créatures)

### Character

- **Capacités**: Capable d’attraper des objets/des créatures de loin, crafter des objets. L’énergie qu’il prend dans les créatures peut être transférée dans des objets pour leur redonner vie (puzzles) et la reprendre aussi.
- **Animations**: Sauter, marcher, courir, se rattraper
- **Equipement**: Notre ver
- **Feedback proprioceptif** *(ce qui le rend cohérent par rapport au design du jeu)*: éléments “légers” dont écharpe, vêtements légers, longs bras qui trainent…

---

# Game Mechanics + Features

- **Inputs** :
    - Pour les éléments proches et statiques, simplement appuyer sur X
        - ⇒ attraper avec le ver
    - Pour les éléments en mouvement (qui peuvent fuir) et/ou éloignés, trigger LT (viser) + appuyer sur X
        - ⇒ lance le ver plus loin pour attraper
- **Collecter une ressource principale :** on aspire l'énergie vitale des créatures, elles remplissent une jauge.
    - **Visuel** : La jauge est matérialisée par un bocal au dos du personnage qui se remplis de liquide un peu brillant.
    - **Variantes d’habillage de la mécanique :** pêcher, cueillir
        - en gros l’idée derrière ça c’est d’apporter un **breath of optional activity™**, mais sans créer vraiment de nouvelles mécaniques. En venant représenter la même mécanique (récolter la ressource principale par des créatures) différemment, on crée une expérience différente pour le joueur, en limitant l’impact du cout de production et en éviter de devoir avoir une nouvelle mécanique qui doit s’intégrer et se lier avec celles qui sont déjà existantes (si on faisait un Moscow pour moi ce serait un could voir un would, c’est intéressant et ça s’intègre bien mais c’est pas indispensable du tout) -Ines
    - **Utiliser ces ressources :**
        - **Insuffler** cette énergie dans des objets organiques pour créer/libérer des passages. Fonctionne en toggle (activer/désactiver).
        - **Reprendre** cette énergie insufflée.
        - **Reward :** Débloquer des passages. Débloquer le morceau de cœur, le revitaliser
    - **Feedback** :
        - **Lorsqu’on aspire l’âme de la créature** : Sound design, tremblement d’écran, recentrage de la caméra, changement d’état de la créature (voir Furtivité)
        - **Action terminée** : élément sonore satisfaisant, le bocal qui se remplit, la créature en état “ragdoll”
- **Collecter des ressources secondaires : À** l’aide de notre vers, on peut aussi récolter d’autres types de ressources, *(fruits, branches, etc.),* sur les créatures, avoir aussi d’autres ressources à récolter *(des ressources sur les créature vivante =/= sur son cadavre)*
    - **Utiliser ces ressources :**
        - voir feature craft
            - **Reward :** L’objet cafté

### **COZY**

- **Absence de danger physique ou émotionnel** : Notre personnage **ne peut pas mourir** et ne se fera pas juger pour ses actions dans la diégèse du jeu.
- **Pas de pression de temps :** Le joueur est libre de prendre son temps et de regarder le paysage. Il n’y a pas de temps imposé pour réaliser les actions et les objectifs.
    - Cycle jour-nuit qui n’a pas d’effet sur le gameplay
    
- **Abondance :** La seule ressource à collecter, c’est l’énergie vitale des créatures, et ce n’est pas une ressource qui nous ferait mourir si l’on en a plus. Le but serait de faire en sorte qu’il y ait plein de vie sur ces îles pour que l’on puisse s’abreuver constamment.
    - La key feature la vie DOIT être rapide. On va passer le jeu à faire ça : il faut plusieurs animations pour dynamiser la mécanique et la rendre réellement satisfaisante

- **Les PNJ** : avec de fortes personnalités, jouer avec stéréotypes : calme, excité, colérique, triste, joyeux…
    - Nous donnent des quêtes qui vont nous aider pour l’objectif à long terme.

- **Notion de connexion/accomplissement :** On a un objectif que l’on accomplit au fur et à mesure du jeu et qui se voit physiquement quand on raccroche les îles.
- **Safe zone :** la zone près du gardien qui est illuminée, très rassurante, et où on peut se reposer
- **Planer :** Le joueur peut se déplacer d’une île à l’autre grâce à son planeur.
    - Appuyer sur une toucher pour se poser sur île
- **Feedbacks :** Beaucoup de rewards sonores et visuels aux actions importantes (ex. aspirer les âmes, crafting…)
- ***Crafter :** Il y a la possibilité de crafter des objets pour accomplir des quêtes, et des pièges pour capturer des créatures afin de plus facilement voler leur âme.*

### **ANTI COZY : La dissonance**

- **Confinement et limite de visibilité :** Dans les profondeurs, limiter l’espace au maximum pour créer un malaise
- **Dynamiser les niveaux :** Jouer sur la distance entre nos îles pour rajouter de temps en temps une petite île avec un PNJ (à la Outer Wilds) qui est perdu, ou qui vit sa vie tranquillement.
- **Le ver :** ce qui nous sert de key feature. Il est un petit animal qui va mordre les créatures pour s’accrocher à elles afin de leur voler leur âme.
- **Les tunnels :** afin d’atteindre le morceau de coeur de chaque île objectif, il faut débloquer un tunnel

---

# Objectifs

## Short-Term Goals

Trouver les ressources nécessaires pour compléter des crafts

## Mid-Team Goals

Compléter les quêtes données par les PNJ et retrouver le morceau de coeur sur chaque île

## Long-Team Goals

Revitaliser le Coeur et sauver Nuvenia

---

# Gameplay loops

## Micro loops

Les loops rapides du jeu: aspirer des ennemis et trouver des ressources. Ces deux loops peuvent être liées.

- Trouver des ressources → Récolter des ressources → Crafter → Reward → Repeat
- Spotter une créature → chasser la créature → Vaincre la créature → Reward → Repeat

![Screenshot 2024-04-20 at 16.32.49.png](Gameplay/Screenshot_2024-04-20_at_16.32.49.png)

![Screenshot 2024-04-20 at 16.31.36.png](Gameplay/Screenshot_2024-04-20_at_16.31.36.png)

## Mid Loop

La boucle moyenne du jeu. C’est les objectifs qui prennent un peu plus de temps mais ne sont pas la finalité du jeu.

- Spotter un PNJ → Lui parler → Il nous donne une quête et on la débute → On la réussit → On obtient une récompense immédiate → Repeat

![Screenshot 2024-04-20 at 16.34.55.png](Gameplay/Screenshot_2024-04-20_at_16.34.55.png)

## Macro Loop

La loop la plus générale du jeu, les objectifs à long terme: 

- Voyager entre les îles → se poser sur une île → explorer → trouver un morceau de coeur → le revitaliser → le ramener au centre → Repeat

![Screenshot 2024-04-20 at 16.35.15.png](Gameplay/Screenshot_2024-04-20_at_16.35.15.png)

---

# Les profondeurs

Afin de revitaliser chaque morceau de cœur sur chaque île, il faut passer par les profondeurs qui sont divisées en deux phases : Les puzzles au différents étages 

Au bout du tunnel se trouve le morceau de cœur, qui a une taille considérable, qui est revitalisé grâce à l’énergie collectée avec les créatures

Dans ces tunnels, ce sont des phases de puzzles. À l’aide de l’énergie récoltée sur les créatures et de la lumières, il faudra se créer un chemin vers les étages inférieurs délimités par des portes qui nécessitent de l’énergie pour s’ouvrir (une fois donnée aux portes, l’énergie ne peut pas être récupérée). 

Dans les profondeurs, il y a un mal physique qui traine sur le sol, le miasme. C’est une sorte de gélatine menaçante qui nous met KO lorsqu’on la touche pendant plusieurs secondes. Pour s’en débarrasser, il faudra prendre une de nos lumières que l’on a craft (la même que pour voir dans l’obscurité) et la déposer dans les socles. Une fois déposé, il est impossible de récupérer notre lumière, mais le socle s’active, éclairant la zone et dégageant le miasme de cet endroit.

La mécanique de prise d’énergie nous est aussi utile dans ces profondeurs, où il nous sera demandé d’infuser de l’énergie dans des objets pour activer des passages (escaliers, ponts, murs d’escalade, etc.), cette énergie pourra quant à elle être reprise une fois que l’on est passé, et cela, d’ailleurs le principal outil des puzzles : ce don et cette prise d’énergie pour nous frayer un chemin. Tout en libérant le passage du miasme qui l’envahit grâce aux lumières. 

---

# Le Craft

<aside>
<img src="https://www.notion.so/icons/alert_gray.svg" alt="https://www.notion.so/icons/alert_gray.svg" width="40px" /> Cette mécanique est encore en cours de définition

</aside>

- Un inventaire avec les objets craftés
- On craft directement dans l’inventaire
- Séparer craft, ingrédients, objets dans le même menu
- “Livret de recettes”

## Craft

## Ressources

| Ressources | Monstre ou enviro ? | Apparition dans les craft | Commentaire | Drop Rate ? (M2?) |
| --- | --- | --- | --- | --- |
| Source bioluminescente | Petite créature  | Lumière | Requiert une partie lumineuse dans le design de la créature (message pour les arts) | 50 % |
| Objet solide végétal trouvable dans la nature  | Environnement (trouvable en surface et dans les sous terrains) | Lumière
Pièges
Appâts | Objet qui aurait pour fonction de contenir la source lumineuse, exemple : cocon, bâton pour torche, toile d'araignée,  bulle, etc (message pour les arts) | 100 % |
| Nourritures végétales qu’on cueille | Trouvable en surface près de la végétation → zones forestières et clairières dans des buissons (sortes de baies) ou a terre au pied des arbres | Appâts |  | 100 % |
| Runes | Trouvable dans les cavernes | Téléporteur |  | 100 % |
| Toiles d’araignées ou fil | Surfaces → zones forestières accrochés aux arbres à hauteur moyenne | Pièges
Téléporteur |  | 100 % |
| Composant venant des moyennes créatures lors du drainage | Créatures moyenne | Pièges 
Téléporteur |  | 50 % |

---

# Progressions

## Game Progressions

### Demo (M1)

- Petit écran, texte de narration qui nous met au courant de notre objectif et du contexte du monde dans lequel on se trouve.
- Le joueur prend possession du personnage (Mae) sur l’île.
- On lui apprend qu’il peut aspirer l’énergie des créatures et différentes ressources
- Est-ce qu’on lui montre l’entrée de la cave ?
- Cette cave a une porte fermée qui nécessite X valeur d’énergie vitale pour s’ouvrir.
- Une fois qu’il a tué des créatures, il récupère de l’énergie.
- Sur les créatures, il peut réaspirer une fois morte une ressource secondaire (ici un objet bioluminescent qui lui permettra de craft de la lumière).
- Avec les deux ressources nécessaires, il peut crafter des sources de lumières.
- Il a assez d’énergie ! Il retourne à la porte et lui donne de l’énergie (la porte ne lui rend pas l’énergie prise). Elle s’ouvre.
- À l’intérieur, on lui montre qu’il peut aussi aspirer de l’énergie et surtout en remettre aussi à certains endroits prédéfinis. Il est dans une salle puzzle.
- Dans cette salle de puzzle, il doit donc comprendre un trajet qu’il mettra en place grâce au don et à la prise d’énergie.
- Une fois le chemin tracé, il se retrouve devant une autre porte qui nécessite aussi une quantité d’énergie prédéfinie.
- Une fois l’énergie récoltée, il ouvre la porte. Il voit qu’il y a un tunnel sombre qui semble s’enfoncer un peu et il entend un son qui l’attire.
- En descendant, il se retrouve face à un morceau de cœur. En le prenant, une fenêtre s’ouvre et lui explique ce qu’il a récupéré  et lui dit qu’il peut aller le valider à l’île principale pour rapprocher les deux îles.
- Fin du proto de juin.

### Onboarding (M2)

**Mécaniques apprises**: Aspirer et planer

- Aller parler au gardien dans l’île centrale qui nous lance dans la première quête :
    
    → Il nous apprend a capturer notre première créature de petite taille, ce qui remplit notre bocal
    
    → On est lancés dans un voyage vers la premiere ile, où on apprend à utiliser le planeur
    
    → Lorsqu’on arrive sur la première île, on met en pratique ce qu’on a appris dans l’île centrale: on commence à récolter des ressources et attraper des créatures de petite taille
    
    → On arrive, dans un premier temps, relativement facilement à l’entrée des tunnels
    
    → On navigue dans les tunnels un peu inquiétants et on utilise un peu de notre énergie pour raviver un pont, ouvrir une porte raviver une échelle… (tout cela comporte des feedbacks visuels et sonores)
    
    → On arrive au morceau de Coeur, on verse le contenu de notre bocal pour le raviver
    
    → Il reprend vie et on l’obtient dans notre inventaire
    
    → Retour a l’ile principale, 
    
    → On va voir le gardien pour confirmer la quête
    → On peut poser le morceau de coeur directement ou le garder sur nous afin de tout poser d’un seul coup à la fin du jeu 
    

### M2

<aside>
<img src="https://www.notion.so/icons/light-bulb_gray.svg" alt="https://www.notion.so/icons/light-bulb_gray.svg" width="40px" /> Cette dynamique sera plus ou moins présente dans tous les niveaux, à quelques détails près. Au plus les niveaux avancent, au plus on apprend de nouvelles mécaniques.

→ *Ex: crafter un piège viendra dans le niveau 2*

</aside>

### General Progression

- **1e île** : le joueur ne peut attraper que des créatures de petite taille
- **2ᵉ ile :** le gardien nous met en garde puisque cette ile demande plus d’énergie vu sa plus grande taille. Mais bonne nouvelle : on y trouve des créatures plus grosses. Il nous apprend alors à les attraper, et nous montre comment crafter un piège qui attirerait un grand nombre de ces créatures.
***Mécanique apprise : Crafter***
- **3ᵉ île** : on tombe nez à nez avec un PNJ ‘pêcheur’ (Fil le pêcheur) perdu dans la nature. Il est en train de pêcher et apprend au joueur cette variante de récolte.
***Mécanique apprise : Pêcher***
- **4ᵉ île** : des animaux plus gros, dont les âmes sont plus difficiles à obtenir du premier coup.
- **5ᵉ île** : des PNJ perdus, qui ont refait leur maison dans la nature, et qui sont assez grincheux. Ils bloquent l’entrée des tunnels et demandent une quête assez importante
- **6ᵉ île** : dernière île. Un rassemblement de toutes les mécaniques en même temps
- **Fin du jeu :** Lorsque tous les morceaux de cœur sont rassemblés dans l’île centrale, les îles s’emboîtent dans les parties manquantes de l’île, créant ainsi un sentiment d’accomplissement et de satisfaction

## Character Progressions

Le personnage débute avec uniquement son ver qui lui permet d’aspirer les âmes des créatures. 

Au fur et à mesure de sa progression, il obtient la capacité de crafter

Il arrive à rassembler de plus en plus de cœurs

Il découvre le lore à travers les quêtes des PNJ

---

# Obstacles

Ce qui rajoute du challenge à notre joueur.

- Les créatures qui s’enfuient
- Les PNJ qui bloquent certains accès tant qu’on n’a pas fini leur quête
- Les îles bloquées tant qu’on n’a pas terminé l’île actuelle

---

# Miasme

Élément physique uniquement présent dans les caves qui prend la forme de gélatines sur le sol qui blesse le joueur jusqu’à ce que le joueur soit assommé (Game over). Le joueur respawn juste devant la grotte près du téléporteur de base.

Présent dans les profondeurs comme obstacle que l’on doit “nettoyer” pour avancer. Ils sont nettoyés avec la lumière.

| Name | Description | Dynamic/Static |
| --- | --- | --- |
| Dégats | Dégats que le miasme nous fait ou à notre barre d’énergie | Static |
| Zone | Prédéfinie | Static |
| Socle  | le miasme est lié à un socle, qui lorsqu’on pose de la lumière dessus, désagrège le miasme | Static |
- Une fois posée dans son socle, la lumière dégage le miasme.
- Si on est dans le miasme quelques secondes, notre personne tombe ko.

---

# Puzzles

Dans les profondeurs, pour avancer et rejoindre le cœur il faut passer par des puzzles. Les puzzles fonctionnent avec l’énergie vitale et la lumière. Il est possible d’insuffler de l’énergie vitale dans des objets pour en créer des ponts, murs d’escalade, plateforme, escaliers, etc. Cette énergie peut ensuite être reprise pour libérer un passage ou réactiver l’objet suivant.

- Lié aux mécaniques de miasme, énergie et lumière.
- Les miasmes bloquent le passage et l’on doit activer des socles de lumières pour les purifier.
- Cette lumière, c'est la même que celle que nous avons en main pour nous éclairer : quand on la pose, on en perd une dans notre inventaire. À la différence de la lumière qui nous éclaire (comme une torche), celle-ci ne s’estompe pas.
- À la fin du puzzle de chaque étage, il y a une porte qui nous prend un nombre donné d’énergies pour s’ouvrir. On ne peut pas les récupérer

## Premier Puzzle : Le tuto

/!\ Quand on parle d’auto lock pour les objets liés à l’énergie, c’est le même auto lock que pour les créatures. C’est pour faire comprendre au joueur que, de la même façon qu’il peut aspirer l’énergie des créatures, il peut aussi aspirer ou donner de l’énergie dans ces objets.

![Plan de travail – 67.png](Gameplay/Plan_de_travail__67.png)

![Plan de travail – 70.png](Gameplay/Plan_de_travail__70.png)

![Plan de travail – 69.png](Gameplay/Plan_de_travail__69.png)

![Plan de travail – 71.png](Gameplay/Plan_de_travail__71.png)

![Plan de travail – 72.png](Gameplay/Plan_de_travail__72.png)

---

# Level Design

Basé sur le document “RLD” du cours de Game Design au Q1 et adapté pour notre projet.

## Rational Level Design

### Capacités

|  | Capacités générales | Capacités spécifiques | Description | Conditions d’accès | Indice de difficulté sur 10* | Lieu d’acquisition | Utilité principale | Utilité secondaire |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PERSONNAGE (Maë) |  |  |  |  |  |  |  |  |
| LE VER |  |  |  |  |  |  |  |  |

> **L’indice sur 10 est basé sur le nombre d’inputs nécessaires pour executer la capacité*
> 

### Bestiaire

Une vue globale des créatures

| Nom/Type | Asset | Trouvable dans le niveau | Points de vie | Indice de difficulté* | Récompense spécifique ? | Commentaire |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |

> **L’indice de difficulté est basé sur le temps nécessaire pour achever la créature. 
Petites tailles → 0 à 5
grandes tailles → 6 à 10*
> 

### Objets LD

Objets de collisions, de décor…

| Nom  | Asset | Description | Pattern de déplacement *(statique ou dynamique)* | PV (si destructible) | Indice de difficulté | Moyens  de passer les objets |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |

### Objets avec lesquels on peut interagir

Ingrédients de craft, objets craftés, etc.

| Nom | Asset | Description | Pattern de déplacement | PV (si destructible) | Avantages? | Moyen d’obtention |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |

## Levels

Les éléments des niveaux (les îles). Comment nous souhaitons guider le joueur du début à la fin du niveau, les éléments importants, la difficulté, éléments de verticalité, etc. 

| Nom  | Description | Début | Objectif | Challenge | Fin | Reward | Indice de difficulté* |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Forêt | Une forêt dense qui cache de nombreuses créatures | On atterrit à l’entrée de la forêt, on se lance à la recherche des créatures | Trouver l’entrée des tunnels | Récolter le plus d’énergie possible | Revitaliser le coeur | Retour de l’île au hub  | 1 |
|  |  |  |  |  |  |  |  |

> **Indice de difficulté basé sur la longueur moyenne pour compléter un niveau → sur 10*
> 
- Schémas :
- Références visuelles :

## Learning Curve

→ à faire lorsqu’on aura plus de contenu à tester

---

# Téléporteurs

Placer des téléporteurs pour créer des raccourcis entre la surface et les cavernes

- Faciliter les aller-retour entre la surface et les cavernes
- Créer un enjeu en liant le téléporteur à une ressource épuisable
- Notion de choix avec le fait qu’on puisse avoir qu’un téléporteur à la fois
- Le TP est un craft qui permet de faire des allers-retour dans la caverne
- Poser une balise/point/porte par terre (à nos pied) dans la caverne et une fois placé, nous téléporte à l’entrée de de celle-ci
- À chaque nouveau point de TP placé, l’ancien s’efface
- Les portes sont des checkpoints

# Contrôles

| Name | Input | Action |
| --- | --- | --- |
| Sélectionner les téléporteur dans l’inventaire | Manette : croix directionnel du bas | sélectionne l’item |
| Poser un téléporteur | Manette : Bouton X (Xbox) | Poser téléporteur |

# Attributs

| Name | Description | Dynamic/Static |
| --- | --- | --- |
| Placement | temps de placement du téléporteur > que temps de mort dans le miasme OU BIEN, on peut pas le poser dans le miasme
Peut-être placé n’importe où mais uniquement dans les cavernes | static |
| Durée | infini | static |
| Craft | - Runes
- Toiles d’araignées ou fil
- Composant venant des moyennes  créatures lors du drainage | 1 de quantité dans l’inventaire |

---

# Lumière

Puisque l’on doit pouvoir se déplacer dans des souterrains, la luminosité y est logiquement limitée. Pour remédier à cette situation, il a été discuté que l’on pourrait se servir de la lumière pour pouvoir se balader dans les souterrains, et que sans lumière, il serait quasi impossible de pouvoir y rentrer. C’est elle aussi qui nous permet, une fois insérée dans un socle dans les profondeurs, de faire fuir les miasmes qui nous bloquent la route.

Pour générer un sentiment d’inconfort chez le joueur, la lumière n’est pas fiable. Il peut arriver qu’elle se coupe pour laisser le joueur dans l’obscurité quelques secondes.

La lumière est liée à un Craft. 

- La lumière est éternelle quand on la pose dans les réceptacles.
- Elle se consomme quand on l’utilise pour voir.

## Contrôles

| Name | Input | Action |
| --- | --- | --- |
| Use |  | Utiliser la lumière pour s’éclairer. |
| Put down |  | Mettre la lumière dans son socle. Génère de la lumière, mais surtout dégage le miasme |

## Attributs

Même objets mais deux règles :

| Name | Description |
| --- | --- |
| Lumière “torche” | La lumière que l’on peut activer dans notre main. Elle fonctionne comme une torche et se consomme avec le temps. |
| Lumière “puzzle” | C’est la même lumière que la torche sauf qu’en la posant dans le socle, elle devient éternelle et enlève le miasme associé à ce socle. |

# Recette de craft

| Nom | Type | Ingredients | Function | Usage |
| --- | --- | --- | --- | --- |
| Light | Consumable | Bioluminescent Source from small creature + solid object found in nature (e.g., cocoon, stick, spider’s web) | Illuminate our surroundings | Once activated, it consume in X seconds. |

---

# Les pièges et appâts

# Pièges

Les pièges sont des crafts liés à la captures de créatures de taille moyenne ou grande exclusivement. Ils servent à affaiblir, ralentir, immobiliser les créatures que l’on souhaite attraper. Ils s’utilisent comme ça :

- équiper le pièges
- le poser par terre en maintenant une touche
- le piège s’active et immobilise la créature pendant 10 sec
- le piège se détruit

## Contrôles

| Name | Input | Action |
| --- | --- | --- |
| équiper | Manette : croix directionnel droite | équiper le piège dans ses mains |
| Poser un piège | Maintenir | Pose un piège à ses pieds ou le lance ? |
| Activation piège | automatique | S’active automatiquement quand un ennemi passe dessus |

## Attributs

| Name | Description | Dynamic/Static |
| --- | --- | --- |
| Durée avant utilisation | infini | static |
| radius d’activation  | la zone d’activation du piège est 1/2 m autour du modèle du piège | static |
| Durée d’immobilisation | la créatures est immobilisé pendant 10 sec | dynamique |
| destruction | destruction après utilisation du piège | static |

# Appâts

## Contrôles

| Name | Input | Action |
| --- | --- | --- |
| équiper | Manette : croix directionnel du gauche | équiper l’appât dans ses mains |
| Poser l’appât | maintenir X (Xbox) | Poser l’appât par terre |
| Lancer appât (pas prototype) |  |  |

# Liste appâts

| Name | Description | Dynamic/Static |
| --- | --- | --- |
| Nourriture (Appâts) | un fruit, un objet solide (exemple: panier tressé avec des baies qu’on pose par terre) | Static |
|  |  |  |

---

# Furtivité ?

- **Condition de déclenchement du “Spotted” d’une créature :**
    - Le joueur rentre dans le champ de vision des créatures
    - Une créature se fait aspirer son énergie vitale dans le champ de vision d’une autre créature