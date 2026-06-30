# Constitution for a new project

We are writing the constitution for <project_name>Chemins du Soleil</project_name> a project with the description as seen below:

<project_description>
This is an application that will be used by people skiing in the "Portes du Soleil". The application will feature simple UX as it is meant to be used in cold conditions where the two main inputs are a "start" lift or location and an "destination" lift or location.

The application will also allow to filter for maximum difficulty of slopes. Ski slopes have 4 categories, going from easy to expert: green, blue, red, black. The user will be able to specify a maximum difficulty and the system will show the options to get to the destination if it exists. As an example, if a user choses as the maximum slope difficulty BLUE, the system will only look for a route that is comprised of GREEN and BLUE slopes. Note that this might mean that a route might not be possible, and the app should indicate to the user that there is no existing route if so.

Please note that the resort "Portes du Soleil" is quite large, and has multiple sub resorts (like Roc d'Enfer, Avoriaz, Le Gets, etc) and spans across 2 countries (France and Switzerland). I expect the lift to have little emoji flags indicators to indicate where you are.

</project_description>

<technical_hints>
The underlying idea is to use a structure like a graph and over it Djisktra's algorithm to see if there is a path between 2 places/ski lifts. This about this like a Citimapper or Google Maps for the Portes du Soleil ski resort.

The underlying weigthed graph will use slope colours to find the best route if it exists.
</technical_hints>

<data_hints>
A simple method for keeping lifts/resorts up to date is prefered. Likely a json file that lists all possible stops/nodes as objects and provides the relevant information like "country", "lift_name", "lift_type" (could be chair lift or a gondola or a big telecabin), a "slopes" object with multiple "slope" inner objects that each have a "name" and a "difficulty" or "colour".
</data_hints>

<roadmap_considerations>
- Add to the backlog of features once the main app is built to add support for things like use geolocation to detect the closest station, and even possibly a map and map route overlay.
</roadmap_considerations>

## Instructions

We will now create the constitution, which is the evergreen document that describes the current project. In a 'specs' directory, create:
- `mission.md` describes the project, goals and stakeholders of the project. Make sure it is clear WHY we are building the project.
- `tech-stack.md` to describe how we want to build the project. For added reference check if there is a <additional_md_files>`prompts/pwa.md`</additional_md_files>. This is the HOW are we building the project.
- `roadmap.md` for a high-level implementation order, in very small phases of work.


## Additional guidelines

- Check to see if there is an `AGENTS.md`, `README.md` or any specific agent file like `CLAUDE.md` or their local variations to retrieve additional context.
- Ask necessary questions to create a concise non-ambiguos constitution.
- refer to `prompts/BRAND_DESIGN.md` for considerations on colours, branding, and visuals, if present. Ask if there is any doubt.