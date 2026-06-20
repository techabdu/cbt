<?php

namespace App\Http\Requests\ExamOfficer;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateDepartmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $schoolId = $this->attributes->get('school_id');
        $deptId   = $this->route('department')?->id;

        return [
            'name'      => ['required', 'string', 'max:255'],
            'code'      => ['required', 'string', 'max:30',
                Rule::unique('departments', 'code')->where('school_id', $schoolId)->ignore($deptId)],
            'full_name' => ['nullable', 'string', 'max:500'],
        ];
    }
}
