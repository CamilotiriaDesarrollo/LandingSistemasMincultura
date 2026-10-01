namespace Servidor.Modelos;

/// <summary>Tema bajo el que se agrupan los portales.</summary>
public record Categoria(string Id, string Name, string Short, string Desc, string Color);

/// <summary>Portal o sistema de información enlazado desde la landing.</summary>
public record Portal(string Name, string Desc, string Url, string Category);

/// <summary>Contenido completo de la landing. Se lee de Datos/portales.json.</summary>
public record Directorio(List<Categoria> Categories, List<Portal> Portals, List<string> Favorites);
