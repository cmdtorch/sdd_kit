from rest_framework import viewsets

from .models import Sale
from .permissions import IsAccountantOrAdmin
from .serializers import SaleSerializer


class SaleViewSet(viewsets.ModelViewSet):
    """/api/v1/inventory/sales/ — list is paginated (25 per page), filterable by student and status."""

    queryset = Sale.objects.select_related("student", "service")
    serializer_class = SaleSerializer
    permission_classes = [IsAccountantOrAdmin]
    filterset_fields = ["student", "status"]
