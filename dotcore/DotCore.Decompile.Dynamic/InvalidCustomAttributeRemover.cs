// PY-REF: none (DOT-only)
using AsmResolver.DotNet;

namespace DotCore.Decompile.Dynamic;

internal static class InvalidCustomAttributeRemover
{
    internal static int Remove(ModuleDefinition module)
    {
        int removedCount = 0;
        RemoveFrom((IHasCustomAttribute)module, ref removedCount);
        if (module.Assembly != null)
            RemoveFrom(module.Assembly, ref removedCount);
        foreach (TypeDefinition type in module.GetAllTypes())
        {
            RemoveFrom(type, ref removedCount);
            foreach (GenericParameter genericParameter in type.GenericParameters)
            {
                RemoveFrom(genericParameter, ref removedCount);
                foreach (GenericParameterConstraint constraint in genericParameter.Constraints)
                    RemoveFrom(constraint, ref removedCount);
            }
            foreach (InterfaceImplementation implementation in type.Interfaces)
                RemoveFrom(implementation, ref removedCount);
            foreach (FieldDefinition field in type.Fields)
                RemoveFrom(field, ref removedCount);
            foreach (PropertyDefinition property in type.Properties)
                RemoveFrom(property, ref removedCount);
            foreach (EventDefinition @event in type.Events)
                RemoveFrom(@event, ref removedCount);
            foreach (MethodDefinition method in type.Methods)
            {
                RemoveFrom(method, ref removedCount);
                foreach (ParameterDefinition parameter in method.ParameterDefinitions)
                    RemoveFrom(parameter, ref removedCount);
                foreach (GenericParameter genericParameter in method.GenericParameters)
                {
                    RemoveFrom(genericParameter, ref removedCount);
                    foreach (GenericParameterConstraint constraint in genericParameter.Constraints)
                        RemoveFrom(constraint, ref removedCount);
                }
            }
        }
        return removedCount;
    }

    private static void RemoveFrom(IHasCustomAttribute owner, ref int removedCount)
    {
        for (int index = owner.CustomAttributes.Count - 1; index >= 0; index--)
        {
            try
            {
                _ = owner.CustomAttributes[index].Signature;
            }
            catch
            {
                owner.CustomAttributes.RemoveAt(index);
                removedCount++;
            }
        }
    }
}
